#!/usr/bin/env bash
# Pin the security-fixed upstream release instead of Debian's older 4.6.1.
set -euo pipefail
version=4.17.2
revision=de0c9b28f22281a0251d7e98aa8a097895a5b185
checksum=3d6fa86bb713379e735342ef640b93f64272b79af0318ad70a6a871cff0ccc93
prefix="$HOME/.local/lib/bonk-club/coturn-$version"
if test -f "$prefix/bin/turnserver" && test -f "$prefix/source-revision" && test "$(cat "$prefix/source-revision")" = "$revision"; then
  chmod 0755 "$prefix/bin/turnserver"
  "$prefix/bin/turnserver" --version
  echo "Coturn $version already built."
  exit 0
fi
mkdir -p "$HOME/.cache"
build_dir=$(mktemp -d "$HOME/.cache/bonk-coturn.XXXXXX")
curl --fail --silent --show-error --location --max-time 120 \
  "https://codeload.github.com/coturn/coturn/tar.gz/$revision" -o "$build_dir/source.tar.gz"
printf '%s  %s\n' "$checksum" "$build_dir/source.tar.gz" | sha256sum --check --status
tar -xzf "$build_dir/source.tar.gz" -C "$build_dir"
cmake -S "$build_dir/coturn-$revision" -B "$build_dir/build" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$prefix" -DBUILD_TESTING=ON
# Limit compilation load on the shared household Pi.
cmake --build "$build_dir/build" --parallel 2
ctest --test-dir "$build_dir/build" --output-on-failure
cmake --install "$build_dir/build"
# Upstream's CMake install currently omits the executable permission.
chmod 0755 "$prefix/bin/turnserver"
printf '%s\n' "$revision" > "$prefix/source-revision"
"$prefix/bin/turnserver" --version
echo "Coturn source and build logs retained in $build_dir"
