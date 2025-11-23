// ai.cpp — MLP mínimo demonstrativo para compilar com Emscripten
#include <emscripten.h>
#include <cmath>
#include <cstdlib>

static int input_dim = 2;
static double w1[32]; // 2 x 16
static double b1[16];
static double w2[16];
static double b2 = 0.0;

extern "C" {

EMSCRIPTEN_KEEPALIVE
void init_weights(){
  for(int i=0;i<32;i++) w1[i] = ((double)rand()/RAND_MAX - 0.5) * 0.2;
  for(int i=0;i<16;i++) b1[i] = 0.0;
  for(int i=0;i<16;i++) w2[i] = ((double)rand()/RAND_MAX - 0.5) * 0.2;
  b2 = 0.0;
}

EMSCRIPTEN_KEEPALIVE
double predict(double* in){
  double hidden[16];
  for(int j=0;j<16;j++){
    double s = b1[j];
    for(int i=0;i<input_dim;i++) s += in[i] * w1[i*16 + j];
    hidden[j] = s > 0 ? s : 0.0; // ReLU
  }
  double out = b2;
  for(int j=0;j<16;j++) out += hidden[j] * w2[j];
  return 1.0 / (1.0 + exp(-out)); // sigmoid
}

}
