import json
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

class FallbackAI:
    def __init__(self):
        self.dataset = []
        self.vectorizer = TfidfVectorizer(stop_words='english')
        self.vectors = None
        self.is_trained = False
        self._load_and_train()

    def _load_and_train(self):
        try:
            dataset_path = os.path.join(os.path.dirname(__file__), 'dataset.json')
            if not os.path.exists(dataset_path):
                logger.warning(f"Fallback AI dataset not found at {dataset_path}")
                return

            with open(dataset_path, 'r') as f:
                self.dataset = json.load(f)

            if not self.dataset:
                return

            patterns = [item['pattern'] for item in self.dataset]
            self.vectors = self.vectorizer.fit_transform(patterns)
            self.is_trained = True
            logger.info(f"Fallback AI trained successfully on {len(self.dataset)} patterns.")
        except Exception as e:
            logger.error(f"Failed to train Fallback AI: {str(e)}")

    def predict(self, log_message: str, exclude_dynamic: bool = False):
        if not self.is_trained or not log_message:
            return {
                "response": "**LogAI Cortex:** No specific match found. Please check network logs and application state."
            }

        dataset = self.dataset
        vectors = self.vectors
        vectorizer = self.vectorizer

        # If we need to exclude dynamic patterns (Tier 1 behavior), we rebuild vectors on the fly
        if exclude_dynamic:
            dataset = [item for item in self.dataset if not item.get("dynamic")]
            if not dataset:
                return {
                    "response": "**LogAI Cortex:** Knowledge base is empty.",
                    "confidence": 0.0
                }
            vectorizer = TfidfVectorizer(stop_words='english')
            patterns = [item['pattern'] for item in dataset]
            vectors = vectorizer.fit_transform(patterns)

        # Vectorize the incoming log message
        query_vector = vectorizer.transform([log_message])
        
        # Calculate cosine similarity against all known patterns
        similarities = cosine_similarity(query_vector, vectors).flatten()
        
        # Find the best match
        best_index = similarities.argmax()
        best_score = similarities[best_index]

        model_name = "LogAI Cortex" if exclude_dynamic else "LogAI Cortex Adaptive"

        # If similarity is above a certain threshold (e.g., 0.02), return the predefined solution
        if best_score > 0.02:
            match = dataset[best_index]
            response = (
                f"**{model_name} (Offline ML - {best_score*100:.0f}% confidence):**\n\n"
                f"**Root Cause Hypothesis:**\n{match['root_cause']}\n\n"
                f"**Recommended Fix:**\n{match['solution']}"
            )
            return {"response": response, "confidence": best_score}
        else:
            return {
                "response": f"**{model_name}:** Anomaly detected, but it does not match known patterns. Please check recent deployments or database metrics.",
                "confidence": best_score
            }

    def add_pattern(self, pattern: str, solution_text: str):
        """Programmatically append a new dynamically generated pattern to dataset.json and retrain."""
        if not pattern or not solution_text:
            return
        
        # Check if the pattern already exists to prevent duplication
        for item in self.dataset:
            if item["pattern"].lower() == pattern.lower():
                return
            
        new_entry = {
            "pattern": pattern,
            "root_cause": "Dynamically cached root cause from active AI analysis.",
            "solution": solution_text,
            "dynamic": True
        }
        
        self.dataset.append(new_entry)
        
        try:
            dataset_path = os.path.join(os.path.dirname(__file__), 'dataset.json')
            with open(dataset_path, 'w') as f:
                json.dump(self.dataset, f, indent=2)
            
            # Retrain the vectorizer with the new dataset
            patterns = [item['pattern'] for item in self.dataset]
            self.vectors = self.vectorizer.fit_transform(patterns)
            self.is_trained = True
            logger.info(f"Fallback AI successfully cached and retrained on new pattern: {pattern[:50]}")
        except Exception as e:
            logger.error(f"Failed to save dynamic pattern to dataset.json: {e}")

# Instantiate a singleton to be used across the app
fallback_ai = FallbackAI()
