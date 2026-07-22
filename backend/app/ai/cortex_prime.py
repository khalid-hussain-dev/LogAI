import json
import os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import logging

logger = logging.getLogger(__name__)

class CortexPrimeAI:
    def __init__(self, version: str, relative_path: str):
        self.version = version
        self.model_name = f"LogAI Cortex Prime {version}"
        self.dataset_path = os.path.join(
            os.path.dirname(__file__),
            '..', '..', '..', '..', *relative_path.split('/')
        )
        self.entries = []
        self.raw_logs = []
        self.vectorizer = TfidfVectorizer(
            stop_words='english',
            ngram_range=(1, 2),
            max_features=35000,
            sublinear_tf=True
        )
        self.vectors = None
        self.is_trained = False
        self._load_and_train()

    def _load_and_train(self):
        try:
            resolved = os.path.abspath(self.dataset_path)
            if not os.path.exists(resolved):
                logger.warning(f"[{self.model_name}] Dataset not found at: {resolved}")
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
                logger.warning(f"[{self.model_name}] Dataset is empty.")
                return

            self.vectors = self.vectorizer.fit_transform(self.raw_logs)
            self.is_trained = True
            logger.info(
                f"[{self.model_name}] Trained successfully on {len(self.entries)} entries."
            )
        except Exception as e:
            logger.error(f"[{self.model_name}] Failed to load or train: {e}")

    def predict(self, query: str):
        if not self.is_trained:
            return {
                "response": (
                    f"**{self.model_name}:** The premium dataset is not loaded. "
                    "Please ensure the dataset file is present and the server has restarted."
                ),
                "confidence": 0.0
            }

        if not query:
            return {"response": f"**{self.model_name}:** Empty query.", "confidence": 0.0}

        try:
            query_vector = self.vectorizer.transform([query])
            similarities = cosine_similarity(query_vector, self.vectors).flatten()

            best_index = similarities.argmax()
            best_score = float(similarities[best_index])

            if best_score > 0.15:
                match = self.entries[best_index]

                category = match.get('category', 'Unknown Category')
                subcategory = match.get('subcategory', '')
                severity = match.get('severity', 'unknown').upper()
                root_cause = match.get('root_cause', 'No root cause found.')
                recommended_action = match.get('recommended_action', 'No recommendation available.')
                
                # V2 specific judgments
                is_anomaly = match.get('is_anomaly', False)
                anomaly_str = "🔴 Anomaly detected" if is_anomaly else "🟢 Benign / Expected"
                alert_required = match.get('alert_required', False)
                alert_str = "⚠️ **Alert Required**" if alert_required else "✅ No alert needed"

                if self.version == "v2":
                    expected = match.get('expected_output', {})
                    next_action = expected.get('next_action', recommended_action)
                    urgency = expected.get('urgency', match.get('urgency', 'low')).upper()
                    blast_radius = match.get('blast_radius', 'none').upper()
                    customer_impact = match.get('customer_impact', 'none').upper()
                    stage = match.get('incident_stage', 'symptom').upper()
                    entities = match.get('entities', {})
                    
                    entities_str = ""
                    if entities:
                        entities_str = "\n**Matched Entities:**\n" + "\n".join(
                            f"  - **{k}:** `{v}`" for k, v in entities.items() if v
                        )

                    response = (
                        f"**{self.model_name} (Confidence: {best_score*100:.0f}%)**\n\n"
                        f"**📂 Category:** {category} → `{subcategory}`\n"
                        f"**🔺 Severity:** `{severity}` | **Urgency:** `{urgency}`\n"
                        f"**Incident Stage:** `{stage}` | {anomaly_str}\n"
                        f"**Blast Radius:** `{blast_radius}` | **Customer Impact:** `{customer_impact}`\n"
                        f"**Action Plan:** {alert_str}\n"
                        f"{entities_str}\n\n"
                        f"---\n\n"
                        f"**🔍 Root Cause Analysis:**\n{root_cause}\n\n"
                        f"**🛠️ Next Judgment Action:**\n{next_action}\n\n"
                        f"---\n"
                        f"*Powered by LogAI Cortex Prime v2 — operational judgment model (10,500 entries).*"
                    )
                else:
                    escalation = match.get('escalation', 'none')
                    priority = match.get('priority', 'unknown')
                    tags = match.get('tags', [])
                    tags_str = ", ".join(f"`{t}`" for t in tags[:6]) if tags else "—"

                    response = (
                        f"**{self.model_name} (Confidence: {best_score*100:.0f}%)**\n\n"
                        f"**📂 Category:** {category} → `{subcategory}`\n"
                        f"**🔺 Severity:** `{severity}` | **Priority:** `{priority}`\n"
                        f"**Status:** {anomaly_str} | {alert_str}\n"
                        f"**Escalation Path:** `{escalation}`\n\n"
                        f"---\n\n"
                        f"**🔍 Root Cause Analysis:**\n{root_cause}\n\n"
                        f"**🛠️ Recommended Action:**\n{recommended_action}\n\n"
                        f"**🏷️ Tags:** {tags_str}\n\n"
                        f"---\n"
                        f"*Powered by LogAI Cortex Prime v1 — trained on 2,500 incident patterns.*"
                    )
                return {"response": response, "confidence": best_score}
            else:
                return {
                    "response": (
                        f"**{self.model_name}:** No known pattern matched this log "
                        f"(best similarity: {best_score*100:.1f}%). "
                        "This may be a novel or environment-specific anomaly. "
                        "Consider routing to DeepSeek for generative analysis."
                    ),
                    "confidence": best_score
                }

        except Exception as e:
            logger.error(f"[{self.model_name}] Prediction failed: {e}")
            return {
                "response": f"**{self.model_name}:** Internal inference error — {str(e)[:120]}",
                "confidence": 0.0
            }

# Instantiate Singletons for both V1 and V2 datasets
cortex_prime_v1 = CortexPrimeAI("v1", "dataset/Cortex-Prime_v1/logai_cortex_prime_v1.jsonl")
cortex_prime_v2 = CortexPrimeAI("v2", "dataset/Cortex-Prime_v2/logai_cortex_prime_v2.jsonl")
