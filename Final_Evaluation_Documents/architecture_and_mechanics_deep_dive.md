# LogAI: Architecture & Mechanics Deep Dive
**Purpose:** Technical reference for the FYP Evaluation covering AI models, dataset mechanics, and server sharing architecture.

---

## 1. The AI Model Architecture & Tiers

LogAI utilizes a progressive, tiered AI system. As you move up the tiers, the models become more sophisticated, moving from static rules to offline vector mathematics.

### Tier 0: LogAI Pulse
- **Architecture:** A fast, static Rules & Regex Engine. Not an ML model.
- **How it works:** Uses predefined patterns (e.g., searching for the word `Exception` or `Timeout`) to flag logs. It acts as the absolute baseline for traditional observability.
- **Dataset:** None. Relies purely on hardcoded developer rules.
- **Confidence Score:** Binary (100% if the rule matches, 0% if it doesn't).

### Tier 1: The Anomaly Engine (Isolation Forest)
- **Architecture:** Unsupervised Machine Learning (`scikit-learn` Isolation Forest).
- **How it works:** It does not read text context. Instead, it extracts mathematical features from every incoming log (e.g., timestamp, severity level, message length, frequency). It plots these points in a high-dimensional space. The algorithm builds random "decision trees" to isolate points. Normal logs are densely packed and take many splits to isolate. Anomalous logs (rare events) are on the edges and take very few splits to isolate.
- **Dataset:** Online Continuous Learning. There is no pre-training dataset. It learns dynamically from the live log stream, building its own baseline of "normal" for every specific server.
- **Confidence Score:** The Anomaly Score (0% to 100%) is inversely proportional to the path length in the forest. We then apply our custom **Severity Bias & Asymptotic Scaler** to force critical errors above a minimum threshold (e.g., 75%), preventing the model from ignoring frequent crashes (Concept Drift).

### Tier 2: LogAI Cortex
- **Architecture:** Baseline Offline Supervised Classification.
- **How it works:** Uses basic TF-IDF (Term Frequency-Inverse Document Frequency) vectorization to classify common errors. 
- **Dataset:** A small, foundational dataset of standard software errors.
- **Confidence Score:** Based on the Cosine Similarity calculation between the incoming log and the dataset.

### Tier 3: LogAI Cortex Prime (v1 & v2)
- **Architecture:** Advanced Offline Supervised Classification with Operational Judgment.
- **How it works:** It converts the raw text of an incoming log into a mathematical vector. Rare words (like `ECONNREFUSED` or `OOMKilled`) are assigned massive mathematical weight. Common words (like `the`, `error`, `failed`) are given low weight. It plots this vector and calculates the **Cosine Similarity** (the angle between vectors) against every single row in its dataset to find the closest match.
- **Datasets (Pre-labeled JSONL files):**
  - **Prime v1 (2,500 entries):** Trained purely on catastrophic, critical incidents. It operates as a "strict alerting" model. If it matches an error, it demands an immediate page.
  - **Prime v2 (10,500 entries):** Trained on Operational Judgment. Thousands of "Hard Negatives" (benign errors, graceful fallbacks, safe retries) were injected into the dataset. It learned **Alert Fatigue Suppression**, allowing it to dismiss safe errors instead of waking up engineers.
- **Confidence Score:** The literal mathematical percentage of the Cosine Similarity match. A 28% confidence means the input log's vector overlapped 28% with the closest historical dataset vector.

---

## 2. Log Matching Mechanism: How AI Suggests Answers

When a user clicks "Ask AI" on a log in the frontend:
1. **Model Selection:** The request is sent to the backend along with the target model (e.g., Prime v2).
2. **Vectorization:** The backend loads the specific JSONL dataset into memory. The incoming log is cleaned and transformed into a TF-IDF vector space based on the vocabulary of the dataset.
3. **Similarity Matrix:** The backend computes the dot product (Cosine Similarity) of the new log vector against all 10,500 vectors in the dataset.
4. **Argmax Extraction:** The backend finds the single row with the highest similarity score (argmax).
5. **Context Return:** Because this is an offline classification model (not a generative LLM), it does not "type out" an answer. Instead, it extracts the `root_cause`, `action_plan`, and `entities` array directly from that matched dataset row and returns it to the frontend.

---

## 3. Off-Topic: Server Sharing Architecture

**Question:** How are we able to share/link servers across different accounts while retaining all log information perfectly?

**Answer:** Through a decoupled **Role-Based Access Control (RBAC)** architecture utilizing both PostgreSQL and Elasticsearch.

1. **The Separation of Concerns:** 
   - **Elasticsearch:** Stores the actual logs. Every log is permanently tagged with a unique `server_id`. Logs do not know who the "owner" is.
   - **PostgreSQL:** Stores the relational user permissions. 
2. **The Linking Mechanism:** 
   - When a user creates a server, a record is created in PostgreSQL mapping `user_id_A` to `server_id_1` as the `OWNER`.
   - When User A invites User B, the logs in Elasticsearch are **not copied or moved**. Instead, a new junction record is added to PostgreSQL mapping `user_id_B` to `server_id_1` with a role of `VIEWER` or `ADMIN`.
3. **The Data Retrieval:** 
   - When User B logs into their dashboard, the backend queries Postgres: *"Which servers does User B have access to?"* Postgres returns `server_id_1`.
   - The backend then securely queries Elasticsearch for logs matching `server_id_1` and streams them to User B's dashboard.
4. **WebSockets:** 
   - Our WebSocket architecture works exactly the same way. The WebSocket doesn't subscribe to a "User". It subscribes to a "Server Room" (`server_id`). As long as Postgres verifies User B has permission to view that server, User B is allowed into the WebSocket room, seeing the exact same live stream as the original owner.
