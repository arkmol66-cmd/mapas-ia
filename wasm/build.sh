#!/usr/bin/env bash
# Gera ai.js + ai.wasm (requer Emscripten: emcc no PATH)
emcc ai.cpp -O3 -s WASM=1 -s EXPORTED_FUNCTIONS='["_init_weights","_predict"]' -o ai.js
echo "Se emcc rodou corretamente, ai.js e ai.wasm foram gerados."
