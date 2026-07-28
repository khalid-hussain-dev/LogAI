# LogAI: Architecture & Mechanics Deep Dive
**Purpose:** Comprehensive technical reference for the FYP Evaluation covering AI models, dataset mechanics, and server sharing architecture.

---

## 1. The AI Model Architecture & Tiers

LogAI utilizes a progressive, tiered AI system. As you move up the tiers, the models become more sophisticated, moving from static rules to offline vector mathematics.

### Tier 0: LogAI Pulse
- **Architecture:** A fast, static Rules & Regex Engine. Not an ML model.
- **How it works:** Uses predefined Regular Expressions (Regex) and direct string matching (e.g., searching for the exact sequence `Exception` or `Timeout`) to flag logs. It acts as the absolute baseline for traditional observability because it requires zero compute overhead.
- **Dataset:** None. Relies purely on hardcoded developer rules.
- **Confidence Score:** Binary (100% if the rule matches exactly, 0% if it doesn't).

### Tier 1: The Anomaly Engine (Isolation Forest)
- **Architecture:** Unsupervised Machine Learning (`scikit-learn` Isolation Forest).
- **How it works:** It does not read text context or understand English. Instead, it extracts mathematical features from every incoming log:
  1. **Temporal Features:** Time of day, day of week.
  2. **Categorical Features:** Severity level (e.g., converting 'error' to a numerical weight).
  3. **Textual Metrics:** Message length, ratio of special characters (crashes often have lots of symbols).
  4. **Frequency Metrics:** How many logs arrived in the last 5 seconds.
  It plots these feature vectors in a high-dimensional space. The algorithm builds random "decision trees" to slice the space. Normal logs are densely packed and take many slices to isolate. Anomalous logs (rare events) are on the edges and take very few slices to isolate.
- **Dataset:** Online Continuous Learning. There is no pre-training dataset. It learns dynamically from the live log stream, building its own baseline of "normal" for every specific server.
- **Confidence Score:** The Anomaly Score (0% to 100%) is inversely proportional to the path length in the forest. We then apply our custom **Severity Bias & Asymptotic Scaler** to force critical errors above a minimum threshold (e.g., 75%). This mathematically prevents **Concept Drift** (the AI ignoring continuous crashes because they became "frequent").

### Tier 2: LogAI Cortex
- **Architecture:** Baseline Offline Supervised Classification.
- **How it works:** Uses basic TF-IDF (Term Frequency-Inverse Document Frequency) vectorization to classify common errors without needing cloud connectivity.
- **Dataset:** A small, foundational dataset of standard software errors.
- **Confidence Score:** Based on the Cosine Similarity calculation between the incoming log and the dataset.

### Tier 3: LogAI Cortex Prime (v1 & v2)
- **Architecture:** Advanced Offline Supervised Classification with Operational Judgment.
- **How it works:** It uses **TF-IDF**. 
  - **TF (Term Frequency):** How often a word appears in a log.
  - **IDF (Inverse Document Frequency):** How rare a word is across the entire dataset.
  It converts the raw text of an incoming log into a mathematical vector. Extremely rare words (like `ECONNREFUSED`, `OOMKilled`, or `Deadlock`) are assigned massive mathematical weight. Common words (like `the`, `error`, `failed`) are heavily penalized and given low weight. It plots this vector and calculates the **Cosine Similarity** (the geometric angle between vectors in multi-dimensional space) against every single row in its dataset to find the closest match.
- **Datasets (Pre-labeled JSONL files):**
  - **Prime v1 (2,500 entries):** Trained purely on catastrophic, critical incidents. It operates as a "strict alerting" model. If it matches an error, it demands an immediate page.
  - **Prime v2 (10,500 entries):** Trained on Operational Judgment. Thousands of "Hard Negatives" (benign errors, graceful fallbacks, safe retries) were injected into the dataset. It learned **Alert Fatigue Suppression**, allowing it to dismiss safe errors instead of waking up engineers.
- **Confidence Score:** The literal mathematical percentage of the Cosine Similarity match. A 28% confidence means the input log's vector overlapped 28% with the closest historical dataset vector.

---

## 2. Log Matching Mechanism: How AI Suggests Answers

When a user clicks "Ask AI" on a log in the frontend, a highly optimized 5-step pipeline triggers:

1. **Model Selection:** The API request routes to the ML inference service along with the target model name (e.g., `Prime v2`).
2. **Vectorization (Inference):** The backend loads the specific pre-trained JSONL dataset into RAM. The incoming log is cleaned (stripped of noise) and transformed into a TF-IDF vector space based on the specific vocabulary weights of the chosen dataset.
3. **Similarity Matrix:** The backend computes the dot product (Cosine Similarity) of the new log vector against all 10,500 historical vectors in the dataset simultaneously using NumPy array broadcasting for speed.
4. **Argmax Extraction:** The backend finds the single row with the highest similarity score (`argmax`).
5. **Context Return:** Because this is an offline classification model (not a generative LLM like DeepSeek or ChatGPT), it does not "type out" an answer. Instead, it extracts the `root_cause`, `action_plan`, and `entities` fields directly from that matched dataset row and returns it to the frontend as structured JSON.

---

## 3. Off-Topic: Server Sharing Architecture (RBAC)

**Question:** How are we able to share/link servers across different accounts while retaining all log information perfectly?

**Answer:** Through a decoupled **Role-Based Access Control (RBAC)** architecture utilizing both PostgreSQL and Elasticsearch. By decoupling the access layer from the storage layer, we achieve secure multi-tenancy without data duplication.

### The Separation of Concerns
- **Elasticsearch (The Storage Layer):** Stores the actual heavy log payloads. Every log is permanently tagged with a unique universal `server_id`. Elasticsearch has absolutely no concept of "users" or "owners".
- **PostgreSQL (The Access Layer):** Stores the lightweight relational user permissions, mapping `user_id` to `server_id`.

### The Linking Mechanism (Under the Hood)
1. **Creation:** When User A creates a server, a record is created in PostgreSQL mapping `user_id_A` to `server_id_1` as the `OWNER`.
2. **Invitation:** When User A invites User B, the logs in Elasticsearch are **not copied or moved**. Instead, a new junction record is added to the `server_shares` table in PostgreSQL mapping `user_id_B` to `server_id_1` with a specific role (`VIEWER` or `ADMIN`).

### The Data Retrieval Flow
1. **Authentication:** When User B logs into the dashboard, their JWT token contains their `user_id`.
2. **Authorization Check:** The backend queries Postgres: *"Which servers does User B have access to?"* Postgres looks at the junction table and returns `server_id_1`.
3. **Log Fetching:** The backend then securely crafts a query to Elasticsearch, enforcing a strict filter: `WHERE server_id = server_id_1`. The logs stream to User B's dashboard securely.

### WebSocket Live Streaming
Our WebSocket architecture leverages `asyncio` Pub/Sub mechanics to respect this exact same boundary:
- The WebSocket connection does not subscribe to a "User Channel". It subscribes to a "Server Room" (`server_id`).
- When User B attempts to open a WebSocket, the backend checks PostgreSQL to verify their RBAC junction row exists. 
- Once verified, User B is allowed into the WebSocket room, seeing the exact same real-time memory stream as the original owner, with zero latency degradation.
