#!/usr/bin/env bash
set -euo pipefail

# Usage: ./prepare_artifacts.sh <REPO_PATH> <TAG_A> <TAG_B>
# Example: ./prepare_artifacts.sh .. SAQ_Layout_1 SAQ_Layout_2

REPO_PATH="${1:-..}"            # path to the repo root (default: parent dir)
TAG_A="${2:-SAQ_Layout_1}"
TAG_B="${3:-SAQ_Layout_2}"
OUTDIR="$(pwd)/artifacts"
PORT_BASE=9000

echo "Preparing artifacts for tags: $TAG_A vs $TAG_B"
mkdir -p "$OUTDIR"
cd "$REPO_PATH"

# create two worktrees (safe: avoid re-cloning)
WT_A="$OUTDIR/$TAG_A"
WT_B="$OUTDIR/$TAG_B"
rm -rf "$WT_A" "$WT_B"
git worktree add --detach "$WT_A" "$TAG_A"
git worktree add --detach "$WT_B" "$TAG_B"

# Function to build a worktree if it has package.json
build_if_needed() {
  WT="$1"
  echo "Checking build for $WT"
  if [ -f "$WT/package.json" ]; then
    echo "Found package.json in $WT - running npm ci && npm run build"
    (cd "$WT" && npm ci --silent && npm run build --silent)
    # assume build outputs to dist/ or build/ - try common folders, copy to hosted folder
    if [ -d "$WT/dist" ]; then
      cp -r "$WT/dist" "$2"
    elif [ -d "$WT/build" ]; then
      cp -r "$WT/build" "$2"
    else
      # if npm build doesn't produce a directory, fallback to repo root (serve)
      cp -r "$WT" "$2"
    fi
  else
    echo "No package.json - serving repo tree as static"
    cp -r "$WT" "$2"
  fi
}

# Create directories to serve
SERVE_DIR="$OUTDIR/serve"
rm -rf "$SERVE_DIR"
mkdir -p "$SERVE_DIR/$TAG_A" "$SERVE_DIR/$TAG_B"

build_if_needed "$WT_A" "$SERVE_DIR/$TAG_A"
build_if_needed "$WT_B" "$SERVE_DIR/$TAG_B"

# start simple static servers with python in background, so chrome can hit them
# these are ephemeral local servers; server process will be managed by the review server
( cd "$SERVE_DIR/$TAG_A" && python3 -m http.server $PORT_BASE > /dev/null 2>&1 & echo $! > "$OUTDIR/$TAG_A.pid" )
( cd "$SERVE_DIR/$TAG_B" && python3 -m http.server $((PORT_BASE+1)) > /dev/null 2>&1 & echo $! > "$OUTDIR/$TAG_B.pid" )

# Wait a moment for servers to start
sleep 1

# Routes to screenshot (customize for your app; at minimum screenshot '/')
ROUTES=("/")

# Viewports to capture (width,height)
VIEWPORTS=("1366,768" "375,812")

# screenshot naming: artifacts/<TAG>/route_index_viewport.png
for i in "${!ROUTES[@]}"; do
  route="${ROUTES[$i]}"
  route_path="${route#/}"  # remove leading slash
  if [ -z "$route_path" ]; then route_path="root"; fi

  for vp in "${VIEWPORTS[@]}"; do
    IFS=',' read -r w h <<< "$vp"
    # before
    OUT_BEFORE="$OUTDIR/${TAG_A}__${route_path}__${w}x${h}.png"
    OUT_AFTER="$OUTDIR/${TAG_B}__${route_path}__${w}x${h}.png"
    URL_A="http://127.0.0.1:$PORT_BASE/$route"
    URL_B="http://127.0.0.1:$((PORT_BASE+1))/$route"

    echo "Capturing $URL_A -> $OUT_BEFORE at ${w}x${h}"
    google-chrome --headless --disable-gpu --hide-scrollbars --window-size=${w},${h} --screenshot="$OUT_BEFORE" "$URL_A" || \
      chromium --headless --disable-gpu --hide-scrollbars --window-size=${w},${h} --screenshot="$OUT_BEFORE" "$URL_A"

    echo "Capturing $URL_B -> $OUT_AFTER at ${w}x${h}"
    google-chrome --headless --disable-gpu --hide-scrollbars --window-size=${w},${h} --screenshot="$OUT_AFTER" "$URL_B" || \
      chromium --headless --disable-gpu --hide-scrollbars --window-size=${w},${h} --screenshot="$OUT_AFTER" "$URL_B"
  done
done

# Build metadata
cat > "$OUTDIR/current_review.json" <<EOF
{
  "tagA": "$TAG_A",
  "tagB": "$TAG_B",
  "serve_port_A": $PORT_BASE,
  "serve_port_B": $((PORT_BASE+1)),
  "routes": ["/"],
  "viewports": ["1366x768", "375x812"],
  "artifact_dir": "$(realpath $OUTDIR)"
}
EOF

echo "Artifacts and screenshots in $OUTDIR"
echo "current_review.json written."
echo "If these python static servers are no longer desired, kill PIDs in $OUTDIR/*.pid"
