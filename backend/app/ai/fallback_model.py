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

    def predict(self, log_message: str):
        if not self.is_trained or not log_message:
            return {
                "response": "**Fallback AI Mode:** No specific match found. Please check network logs and application state."
            }

        # Vectorize the incoming log message
        query_vector = self.vectorizer.transform([log_message])
        
        # Calculate cosine similarity against all known patterns
        similarities = cosine_similarity(query_vector, self.vectors).flatten()
        
        # Find the best match
        best_index = similarities.argmax()
        best_score = similarities[best_index]

        # If similarity is above a certain threshold (e.g., 0.3), return the predefined solution
        if best_score > 0.3:
            match = self.dataset[best_index]
            response = (
                f"**Fallback AI (Fast ML Match - {best_score*100:.0f}% confidence):**\n\n"
                f"**Root Cause Hypothesis:**\n{match['root_cause']}\n\n"
                f"**Recommended Fix:**\n{match['solution']}"
            )
            return {"response": response, "confidence": best_score}
        else:
            return {
                "response": "**Fallback AI Mode:** Anomaly detected, but it does not match known patterns. Please check recent deployments or database metrics.",
                "confidence": best_score
            }

# Instantiate a singleton to be used across the app
fallback_ai = FallbackAI()
