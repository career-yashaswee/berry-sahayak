// Ollama model configuration for Sahayak
export const OLLAMA_MODELS = {
  // Model used by educator for generating quizzes
  EDUCATOR_MODEL: 'qwen3:1.7b',
  
  // Model used by learner (for future features)
  LEARNER_MODEL: 'tinyllama'
};

// Fallback model for command line execution
export const FALLBACK_MODEL = 'tinyllama';

// Educator server IP address 
// Set this to your educator's IP address (e.g., '192.168.1.100')
// Leave empty to require IP as command line argument
export const EDUCATOR_IP = '';

