// Ollama model configuration for Sahayak
export const OLLAMA_MODELS = {
  // Model used by educator for generating quizzes
  EDUCATOR_MODEL: 'qwen3:1.7b',
  
  // Model used by learner (for future features)
  LEARNER_MODEL: 'tinyllama'
};

// Fallback model for command line execution
export const FALLBACK_MODEL = 'tinyllama';

