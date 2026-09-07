#!/usr/bin/env python3
"""Verify local relay authentication and peer isolation without sending to public peers."""
import hashlib, hmac, json, secrets, socket, struct, urllib.request
COOKIE=0x2112A442
request=urllib.request.Request('http://127.0.0.1:8787/ice',headers={'Origin':'https://samcousinsgb.github.io'})
with urllib.request.urlopen(request,timeout=5) as response:
    credential=json.load(response)['iceServers'][1]
def attr(kind,value):
    return struct.pack('!HH',kind,len(value))+value+b'\0'*(-len(value)%4)
def decode(data):
    result={}; offset=20
    while offset<20+struct.unpack('!H',data[2:4])[0]:
        kind,length=struct.unpack('!HH',data[offset:offset+4])
        result[kind]=data[offset+4:offset+4+length]
        offset+=4+((length+3)//4)*4
    return result
def address(ip,port):
    return b'\0\x01'+struct.pack('!H',port^(COOKIE>>16))+bytes(a^b for a,b in zip(socket.inet_aton(ip),struct.pack('!I',COOKIE)))
class Client:
    def __init__(self,kind):
        self.socket=socket.socket(socket.AF_INET,kind); self.kind=kind
        self.socket.settimeout(3); self.socket.connect(('192.168.0.96',3478))
        self.auth=b''; self.key=None
        requested=attr(0x19,b'\x11\0\0\0')
        response,challenge=self.exchange(3,requested)
        assert response==0x113 and challenge[9][2:4]==b'\x04\x01'
        realm,nonce=challenge[0x14],challenge[0x15]
        username,password=credential['username'].encode(),credential['credential'].encode()
        self.key=hashlib.md5(username+b':'+realm+b':'+password).digest()
        self.auth=attr(6,username)+attr(0x14,realm)+attr(0x15,nonce)
        response,allocated=self.exchange(3,requested)
        assert response==0x103, 'Authenticated allocation failed'
        self.port=struct.unpack('!H',allocated[0x16][2:4])[0]^(COOKIE>>16)
        assert 49160<=self.port<=49223
    def read(self):
        if self.kind==socket.SOCK_DGRAM: return self.socket.recv(65535)
        packet=b''
        while len(packet)<20: packet+=self.socket.recv(20-len(packet))
        length=20+struct.unpack('!H',packet[2:4])[0]
        while len(packet)<length: packet+=self.socket.recv(length-len(packet))
        return packet
    def exchange(self,kind,body):
        transaction=secrets.token_bytes(12); body+=self.auth
        packet=struct.pack('!HHI',kind,len(body)+(24 if self.key else 0),COOKIE)+transaction+body
        if self.key: packet+=attr(8,hmac.new(self.key,packet,hashlib.sha1).digest())
        self.socket.sendall(packet); result=self.read()
        assert result[8:20]==transaction
        return struct.unpack('!H',result[:2])[0],decode(result)
    def permission(self,ip,port): return self.exchange(8,attr(0x12,address(ip,port)))
    def send(self,port,payload):
        body=attr(0x12,address('192.168.0.96',port))+attr(0x13,payload)
        self.socket.sendall(struct.pack('!HHI',0x16,len(body),COOKIE)+secrets.token_bytes(12)+body)
    def close(self):
        try: self.exchange(4,attr(0xd,struct.pack('!I',0)))
        finally: self.socket.close()
for protocol,kind in [('UDP',socket.SOCK_DGRAM),('TCP',socket.SOCK_STREAM)]:
    clients=[]
    try:
        a=Client(kind);clients.append(a);b=Client(kind);clients.append(b)
        for ip in ['127.0.0.1','10.1.2.3','192.168.0.97']:
            response,denied=a.permission(ip,80)
            assert response==0x118 and denied.get(9,b'')[2:4]==b'\x04\x03', 'Private destination allowed'
        # Only create a permission: no packet is sent to this public address.
        assert a.permission('8.8.8.8',9999)[0]==0x108, 'Public IPv4 peer incorrectly denied'
        assert a.permission('192.168.0.96',b.port)[0]==0x108
        assert b.permission('192.168.0.96',a.port)[0]==0x108
        a.send(b.port,b'bonk-relay-packet-check')
        packet=b.read()
        assert struct.unpack('!H',packet[:2])[0]==0x17 and decode(packet)[0x13]==b'bonk-relay-packet-check'
        with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as protected:
            protected.bind(('192.168.0.96',0)); target=protected.getsockname()[1]
            assert not 49160<=target<=49223
            protected.settimeout(.3);a.send(target,b'bonk-local-block-check')
            try:
                protected.recv(100)
                raise AssertionError('Relay reached another UDP service on Pi')
            except socket.timeout: pass
        print(f'PASS {protocol}: anonymous rejected, temporary credentials accepted, private destinations denied, relay packet forwarded, other Pi sockets protected.')
    finally:
        for client in clients: client.close()
