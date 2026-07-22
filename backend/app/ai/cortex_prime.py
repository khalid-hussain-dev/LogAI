import json
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

PRIME_DATASET_PATH = os.path.join(
    os.path.dirname(__file__),
    '..', '..', '..', '..', 'dataset', 'logai_cortex_prime_v1.jsonl'
)

class CortexPrimeAI:
    MODEL_NAME = "LogAI Cortex Prime v1"

    def __init__(self):
        self.entries = []
        self.raw_logs = []
        self.vectorizer = TfidfVectorizer(
            stop_words='english',
            ngram_range=(1, 2),  # Use bi-grams for richer context
            max_features=30000,
            sublinear_tf=True    # Reduce impact of high-frequency terms
        )
        self.vectors = None
        self.is_trained = False
        self._load_and_train()

    def _load_and_train(self):
        try:
            resolved = os.path.abspath(PRIME_DATASET_PATH)
            if not os.path.exists(resolved):
                logger.warning(f"[CortexPrime] Dataset not found at: {resolved}")
                return

            with open(resolved, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        self.entries.append(entry)
                        self.raw_logs.append(entry.get('raw_log', ''))
                    except json.JSONDecodeError:
                        continue

            if not self.entries:
                logger.warning("[CortexPrime] Dataset is empty.")
                return

            self.vectors = self.vectorizer.fit_transform(self.raw_logs)
            self.is_trained = True
            logger.info(
                f"[CortexPrime] Trained successfully on {len(self.entries)} entries "
                f"across {len(set(e.get('category','') for e in self.entries))} categories."
            )
        except Exception as e:
            logger.error(f"[CortexPrime] Failed to load or train: {e}")

    def predict(self, query: str):
        if not self.is_trained:
            return {
                "response": (
                    f"**{self.MODEL_NAME}:** The premium dataset is not loaded. "
                    "Please ensure the JSONL dataset file is present and the server has restarted."
                ),
                "confidence": 0.0
            }

        if not query:
            return {"response": f"**{self.MODEL_NAME}:** Empty query provided.", "confidence": 0.0}

        try:
            query_vector = self.vectorizer.transform([query])
            similarities = cosine_similarity(query_vector, self.vectors).flatten()

            best_index = similarities.argmax()
            best_score = float(similarities[best_index])

            if best_score > 0.20:
                match = self.entries[best_index]

                category = match.get('category', 'Unknown Category')
                subcategory = match.get('subcategory', '')
                severity = match.get('severity', 'unknown').upper()
                root_cause = match.get('root_cause', 'No root cause found.')
                recommended_action = match.get('recommended_action', 'No recommendation available.')
                alert_required = match.get('alert_required', False)
                escalation = match.get('escalation', 'none')
                is_anomaly = match.get('is_anomaly', False)
                priority = match.get('priority', 'unknown')
                tags = match.get('tags', [])

                alert_str = "⚠️ **Alert Required**" if alert_required else "✅ No immediate alert required"
                anomaly_str = "🔴 Anomaly detected" if is_anomaly else "🟢 Benign / Expected"
                escalation_str = f"`{escalation}`" if escalation != 'none' else "None"
                tags_str = ", ".join(f"`{t}`" for t in tags[:6]) if tags else "—"

                response = (
                    f"**{self.MODEL_NAME} (Confidence: {best_score*100:.0f}%)**\n\n"
                    f"**📂 Category:** {category} → `{subcategory}`\n"
                    f"**🔺 Severity:** `{severity}` | **Priority:** `{priority}`\n"
                    f"**Status:** {anomaly_str} | {alert_str}\n"
                    f"**Escalation Path:** {escalation_str}\n\n"
                    f"---\n\n"
                    f"**🔍 Root Cause Analysis:**\n{root_cause}\n\n"
                    f"**🛠️ Recommended Action:**\n{recommended_action}\n\n"
                    f"**🏷️ Tags:** {tags_str}\n\n"
                    f"---\n"
                    f"*Powered by LogAI Cortex Prime v1 — trained on 2,500 production-grade incident patterns.*"
                )
                return {"response": response, "confidence": best_score}
            else:
                return {
                    "response": (
                        f"**{self.MODEL_NAME}:** No known pattern matched this log "
                        f"(best similarity: {best_score*100:.1f}%). "
                        "This may be a novel or environment-specific anomaly. "
                        "Consider escalating to on-call or routing to DeepSeek for generative analysis."
                    ),
                    "confidence": best_score
                }

        except Exception as e:
            logger.error(f"[CortexPrime] Prediction failed: {e}")
            return {
                "response": f"**{self.MODEL_NAME}:** Internal inference error — {str(e)[:120]}",
                "confidence": 0.0
            }

# Singleton
cortex_prime_ai = CortexPrimeAI()
