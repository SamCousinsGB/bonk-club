const candidateType = (candidate) =>
  /\btyp (host|srflx|prflx|relay)\b/.exec(candidate?.candidate || "")?.[1] ||
  "unknown";
const counts = () => ({ host: 0, srflx: 0, prflx: 0, relay: 0, unknown: 0 });

// Observe negotiation without replacing PeerJS's SDP or ICE handlers. Reports
// deliberately exclude addresses, SDP, room codes and authentication material.
export class ConnectionDiagnostics {
  constructor() {
    this.records = new Map();
    this.errors = [];
  }
  record(id) {
    if (!this.records.has(id)) {
      if (this.records.size >= 8) {
        const first = this.records.keys().next().value;
        this.records.get(first).stop?.();
        this.records.delete(first);
      }
      this.records.set(id, {
        data: {
          direction: "pending",
          localCandidates: counts(),
          remoteSignaled: counts(),
          remoteAccepted: counts(),
          states: [],
          errors: [],
        },
      });
    }
    return this.records.get(id);
  }
  signal(message) {
    if (message?.type !== "CANDIDATE" || !message.payload?.connectionId) return;
    const r = this.record(message.payload.connectionId);
    r.data.remoteSignaled[candidateType(message.payload.candidate)]++;
  }
  error(error) {
    // PeerJS error messages can contain IDs, addresses or SDP. Keep only type.
    const type = /^[a-z-]{1,40}$/.test(error?.type) ? error.type : "unknown";
    this.errors = [...this.errors, type].slice(-12);
  }
  watch(connection, direction) {
    const pc = connection.peerConnection;
    if (!pc?.addEventListener) return;
    const r = this.record(connection.connectionId);
    r.data.direction = direction;
    const state = () => {
      const next = {
        ice: pc.iceConnectionState,
        gathering: pc.iceGatheringState,
        signaling: pc.signalingState,
        connection: pc.connectionState,
        localDescription: pc.localDescription?.type || null,
        remoteDescription: pc.remoteDescription?.type || null,
        channel: connection.dataChannel?.readyState || null,
      };
      // Preserve the last negotiated descriptions when PeerJS tears down a PC.
      if (next.localDescription)
        r.data.localDescription = next.localDescription;
      if (next.remoteDescription)
        r.data.remoteDescription = next.remoteDescription;
      if (JSON.stringify(next) !== JSON.stringify(r.data.states.at(-1)))
        r.data.states = [...r.data.states, next].slice(-16);
    };
    r.refresh = async () => {
      state();
      try {
        const stats = await pc.getStats(),
          remote = counts();
        for (const s of stats.values()) {
          if (s.type === "remote-candidate")
            remote[s.candidateType in remote ? s.candidateType : "unknown"]++;
          if (
            s.type === "candidate-pair" &&
            s.nominated &&
            s.state === "succeeded"
          ) {
            const local = stats.get(s.localCandidateId),
              other = stats.get(s.remoteCandidateId);
            r.data.selectedPair = {
              local: local?.candidateType,
              remote: other?.candidateType,
              protocol: local?.protocol,
            };
          }
        }
        // Closed PCs may return an empty report; retain earlier observed counts.
        if (Object.values(remote).some(Boolean)) r.data.remoteAccepted = remote;
      } catch {
        /* A closed browser connection may no longer expose stats. */
      }
    };
    const local = (event) => {
      if (event.candidate)
        r.data.localCandidates[candidateType(event.candidate)]++;
    };
    const failure = (event) => {
      if (Number.isInteger(event.errorCode))
        r.data.errors = [
          ...r.data.errors,
          { gatheringCode: event.errorCode },
        ].slice(-12);
    };
    const events = [
      "iceconnectionstatechange",
      "icegatheringstatechange",
      "signalingstatechange",
      "connectionstatechange",
    ];
    for (const event of events) pc.addEventListener(event, state);
    pc.addEventListener("icecandidate", local);
    pc.addEventListener("icecandidateerror", failure);
    const timer = setInterval(() => {
      void r.refresh();
    }, 1000);
    timer.unref?.();
    const stop = () => {
      clearInterval(timer);
    };
    r.stop = () => {
      void r.refresh();
      stop();
      for (const event of events) pc.removeEventListener(event, state);
      pc.removeEventListener("icecandidate", local);
      pc.removeEventListener("icecandidateerror", failure);
    };
    connection.on("open", () => {
      r.data.opened = true;
      void r.refresh();
      stop();
    });
    connection.on("close", r.stop);
    connection.on("error", () => {
      void r.refresh();
    });
    void r.refresh();
  }
  async refresh() {
    await Promise.all([...this.records.values()].map((r) => r.refresh?.()));
  }
  close() {
    for (const r of this.records.values()) r.stop?.();
  }
  report() {
    return structuredClone({
      errors: this.errors,
      connections: [...this.records.values()].map((r) => r.data),
    });
  }
}
