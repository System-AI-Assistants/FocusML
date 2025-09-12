CREATE DATABASE react_db;

\connect react_db;

CREATE TABLE assistants (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    database_url character varying(255),
    version character varying(50),
    stage character varying(50),
    model character varying(255) NOT NULL,
    is_local boolean,
    create_time timestamp without time zone DEFAULT now(),
    last_modified timestamp without time zone DEFAULT now(),
    status text,
    mlflow_run_id text
);


ALTER TABLE assistants OWNER focusml;

--
-- Name: assistants_id_seq; Type: SEQUENCE; Schema: public; Owner: react
--

CREATE SEQUENCE assistants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE assistants_id_seq OWNER focusml;

--
-- Name: assistants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: react
--

ALTER SEQUENCE assistants_id_seq OWNED BY assistants.id;


--
-- Name: model_families; Type: TABLE; Schema: public; Owner: react
--

CREATE TABLE model_families (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    icon character varying(255),
    url character varying(255),
    installed boolean
);


ALTER TABLE model_families OWNER focusml;

--
-- Name: model_families_id_seq; Type: SEQUENCE; Schema: public; Owner: react
--

CREATE SEQUENCE model_families_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE model_families_id_seq OWNER focusml;

--
-- Name: model_families_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: react
--

ALTER SEQUENCE model_families_id_seq OWNED BY model_families.id;


--
-- Name: models; Type: TABLE; Schema: public; Owner: react
--

CREATE TABLE models (
    id integer NOT NULL,
    family_id integer NOT NULL,
    name character varying(255) NOT NULL,
    size character varying(50),
    context character varying(50),
    input_type character varying(100)
);


ALTER TABLE models OWNER focusml;

--
-- Name: models_id_seq; Type: SEQUENCE; Schema: public; Owner: react
--

CREATE SEQUENCE models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE models_id_seq OWNER focusml;

--
-- Name: models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: react
--

ALTER SEQUENCE models_id_seq OWNED BY models.id;


--
-- Name: assistants id; Type: DEFAULT; Schema: public; Owner: react
--

ALTER TABLE ONLY assistants ALTER COLUMN id SET DEFAULT nextval('assistants_id_seq'::regclass);


--
-- Name: model_families id; Type: DEFAULT; Schema: public; Owner: react
--

ALTER TABLE ONLY model_families ALTER COLUMN id SET DEFAULT nextval('model_families_id_seq'::regclass);


--
-- Name: models id; Type: DEFAULT; Schema: public; Owner: react
--

ALTER TABLE ONLY models ALTER COLUMN id SET DEFAULT nextval('models_id_seq'::regclass);


--
-- Data for Name: assistants; Type: TABLE DATA; Schema: public; Owner: react
--

COPY assistants (id, name, owner, database_url, version, stage, model, is_local, create_time, last_modified, status, mlflow_run_id) FROM stdin;
14	test6	debug-user	postgresql://test_data:VcnBcz3APvVfH5gDYxWSWjJdLvzRLtKcvjJZErJGs3FYdd@localhost:5432/test_data	6	staging	mistral:7b	t	2025-07-28 12:41:03.932358	2025-07-28 12:41:03.932358	running	123
36	Adam	68a3fd26-0546-4fa1-be0f-388aaf80f0de	postgresql://test_data:VcnBcz3APvVfH5gDYxWSWjJdLvzRLtKcvjJZErJGs3FYdd@localhost:5432/test_data	1	staging	mistral:7b	t	2025-08-11 23:41:53.603878	2025-08-11 23:41:53.609917	running	5520bd7c438744df844b121d56defa2f
37	TestMistral	68a3fd26-0546-4fa1-be0f-388aaf80f0de	postgresql://test_data:VcnBcz3APvVfH5gDYxWSWjJdLvzRLtKcvjJZErJGs3FYdd@localhost:5432/test_data	3	staging	mistral:7b	t	2025-08-12 01:51:46.168433	2025-08-12 01:51:46.199373	running	7ca61ed3ee114decb39c9483dfa1c5f5
43	TinyLlama	68a3fd26-0546-4fa1-be0f-388aaf80f0de	postgresql://test_data:VcnBcz3APvVfH5gDYxWSWjJdLvzRLtKcvjJZErJGs3FYdd@localhost:5432/test_data	1	staging	tinyllama:latest	t	2025-08-12 02:05:35.598953	2025-08-12 02:05:38.682336	running	258389261457479db4b154693b1a37c9
44	DemoMistral	68a3fd26-0546-4fa1-be0f-388aaf80f0de	postgresql://test_data:VcnBcz3APvVfH5gDYxWSWjJdLvzRLtKcvjJZErJGs3FYdd@localhost:5432/test_data	1	staging	mistral:7b	t	2025-08-12 14:13:57.203531	2025-08-12 14:13:57.240503	running	5d6e97a721a94320885fcebb00e2ecb4
\.


--
-- Data for Name: model_families; Type: TABLE DATA; Schema: public; Owner: react
--

COPY model_families (id, name, description, icon, url, installed) FROM stdin;
1	deepseek-r1	DeepSeek-R1 is a family of open reasoning models with performance approaching that of leading models, such as O3 and Gemini 2.5 Pro.	/images/models/deepseek.png	/library/deepseek-r1	\N
2	gemma3n	Gemma 3n models are designed for efficient execution on everyday devices such as laptops, tablets or phones.	/images/models/gemma.png	/library/gemma3n	\N
3	gemma3	The current, most capable model that runs on a single GPU.	/images/models/gemma.png	/library/gemma3	\N
4	qwen3	Qwen3 is the latest generation of large language models in Qwen series, offering a comprehensive suite of dense and mixture-of-experts (MoE) models.	/images/models/qwen.png	/library/qwen3	\N
5	qwen2.5vl	Flagship vision-language model of Qwen and also a significant leap from the previous Qwen2-VL.	/images/models/qwen.png	/library/qwen2.5vl	\N
6	llama3.1	Llama 3.1 is a new state-of-the-art model from Meta available in 8B, 70B and 405B parameter sizes.	/images/models/llama.png	/library/llama3.1	\N
7	nomic-embed-text	A high-performing open embedding model with a large token context window.	/images/models/nomic.png	/library/nomic-embed-text	\N
8	llama3.2	Meta's Llama 3.2 goes small with 1B and 3B models.	/images/models/llama.png	/library/llama3.2	\N
9	mistral	The 7B model released by Mistral AI, updated to version 0.3.	/images/models/mistral.png	/library/mistral	\N
10	qwen2.5	Qwen2.5 models are pretrained on Alibaba's latest large-scale dataset, encompassing up to 18 trillion tokens. The model supports up to 128K tokens and has multilingual support.	/images/models/qwen.png	/library/qwen2.5	\N
11	llama3	Meta Llama 3: The most capable openly available LLM to date	/images/models/llama.png	/library/llama3	\N
12	llava	🌋 LLaVA is a novel end-to-end trained large multimodal model that combines a vision encoder and Vicuna for general-purpose visual and language understanding. Updated to version 1.6.	/images/models/llava.png	/library/llava	\N
13	phi3	Phi-3 is a family of lightweight 3B (Mini) and 14B (Medium) state-of-the-art open models by Microsoft.	/images/models/microsoft.png	/library/phi3	\N
14	gemma2	Google Gemma 2 is a high-performing and efficient model available in three sizes: 2B, 9B, and 27B.	/images/models/gemma.png	/library/gemma2	\N
15	qwen2.5-coder	The latest series of Code-Specific Qwen models, with significant improvements in code generation, code reasoning, and code fixing.	/images/models/qwen.png	/library/qwen2.5-coder	\N
16	gemma	Gemma is a family of lightweight, state-of-the-art open models built by Google DeepMind. Updated to version 1.1	/images/models/gemma.png	/library/gemma	\N
17	qwen	Qwen 1.5 is a series of large language models by Alibaba Cloud spanning from 0.5B to 110B parameters	/images/models/qwen.png	/library/qwen	\N
18	mxbai-embed-large	State-of-the-art large embedding model from mixedbread.ai	\N	/library/mxbai-embed-large	\N
19	qwen2	Qwen2 is a new series of large language models from Alibaba group	/images/models/qwen.png	/library/qwen2	\N
20	llama2	Llama 2 is a collection of foundation language models ranging from 7B to 70B parameters.	/images/models/llama.png	/library/llama2	\N
21	phi4	Phi-4 is a 14B parameter, state-of-the-art open model from Microsoft.	/images/models/microsoft.png	/library/phi4	\N
22	minicpm-v	A series of multimodal LLMs (MLLMs) designed for vision-language understanding.	\N	/library/minicpm-v	\N
23	codellama	A large language model that can use text prompts to generate and discuss code.	/images/models/llama.png	/library/codellama	\N
24	tinyllama	The TinyLlama project is an open endeavor to train a compact 1.1B Llama model on 3 trillion tokens.	/images/models/llama.png	/library/tinyllama	\N
25	llama3.3	New state of the art 70B model. Llama 3.3 70B offers similar performance compared to the Llama 3.1 405B model.	/images/models/llama.png	/library/llama3.3	\N
26	llama3.2-vision	Llama 3.2 Vision is a collection of instruction-tuned image reasoning generative models in 11B and 90B sizes.	/images/models/llama.png	/library/llama3.2-vision	\N
27	dolphin3	Dolphin 3.0 Llama 3.1 8B 🐬 is the next generation of the Dolphin series of instruct-tuned models designed to be the ultimate general purpose local model, enabling coding, math, agentic, function calling, and general use cases.	/images/models/dolphin.png	/library/dolphin3	\N
28	mistral-nemo	A state-of-the-art 12B model with 128k context length, built by Mistral AI in collaboration with NVIDIA.	/images/models/mistral.png	/library/mistral-nemo	\N
29	olmo2	OLMo 2 is a new family of 7B and 13B models trained on up to 5T tokens. These models are on par with or better than equivalently sized fully open models, and competitive with open-weight models such as Llama 3.1 on English academic benchmarks.	\N	/library/olmo2	\N
30	deepseek-v3	A strong Mixture-of-Experts (MoE) language model with 671B total parameters with 37B activated for each token.	/images/models/deepseek.png	/library/deepseek-v3	\N
31	bge-m3	BGE-M3 is a new model from BAAI distinguished for its versatility in Multi-Functionality, Multi-Linguality, and Multi-Granularity.	\N	/library/bge-m3	\N
32	qwq	QwQ is the reasoning model of the Qwen series.	\N	/library/qwq	\N
33	mistral-small	Mistral Small 3 sets a new benchmark in the “small” Large Language Models category below 70B.	/images/models/mistral.png	/library/mistral-small	\N
34	llava-llama3	A LLaVA model fine-tuned from Llama 3 Instruct with better scores in several benchmarks.	/images/models/llama.png	/library/llava-llama3	\N
35	smollm2	SmolLM2 is a family of compact language models available in three size: 135M, 360M, and 1.7B parameters.	/images/models/smollm.png	/library/smollm2	\N
36	llama2-uncensored	Uncensored Llama 2 model by George Sung and Jarrad Hope.	/images/models/llama.png	/library/llama2-uncensored	\N
37	mixtral	A set of Mixture of Experts (MoE) model with open weights by Mistral AI in 8x7b and 8x22b parameter sizes.	\N	/library/mixtral	\N
38	starcoder2	StarCoder2 is the next generation of transparently trained open code LLMs that comes in three sizes: 3B, 7B and 15B parameters.	\N	/library/starcoder2	\N
39	deepseek-coder-v2	An open-source Mixture-of-Experts code language model that achieves performance comparable to GPT4-Turbo in code-specific tasks.	/images/models/deepseek.png	/library/deepseek-coder-v2	\N
40	all-minilm	Embedding models on very large sentence level datasets.	\N	/library/all-minilm	\N
41	deepseek-coder	DeepSeek Coder is a capable coding model trained on two trillion code and natural language tokens.	/images/models/deepseek.png	/library/deepseek-coder	\N
42	snowflake-arctic-embed	A suite of text embedding models by Snowflake, optimized for performance.	\N	/library/snowflake-arctic-embed	\N
43	phi	Phi-2: a 2.7B language model by Microsoft Research that demonstrates outstanding reasoning and language understanding capabilities.	/images/models/microsoft.png	/library/phi	\N
44	codegemma	CodeGemma is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.	/images/models/gemma.png	/library/codegemma	\N
45	dolphin-mixtral	Uncensored, 8x7b and 8x22b fine-tuned models based on the Mixtral mixture of experts models that excels at coding tasks. Created by Eric Hartford.	/images/models/dolphin.png	/library/dolphin-mixtral	\N
46	openthinker	A fully open-source family of reasoning models built using a dataset derived by distilling DeepSeek-R1.	\N	/library/openthinker	\N
47	llama4	Meta's latest collection of multimodal models.	/images/models/llama.png	/library/llama4	\N
48	orca-mini	A general-purpose model ranging from 3 billion parameters to 70 billion, suitable for entry-level hardware.	\N	/library/orca-mini	\N
49	wizardlm2	State of the art large language model from Microsoft AI with improved performance on complex chat, multilingual, reasoning and agent use cases.	/images/models/wizard.png	/library/wizardlm2	\N
50	smollm	🪐 A family of small models with 135M, 360M, and 1.7B parameters, trained on a new high-quality dataset.	/images/models/smollm.png	/library/smollm	\N
51	dolphin-mistral	The uncensored Dolphin model based on Mistral that excels at coding tasks. Updated to version 2.8.	/images/models/mistral.png	/library/dolphin-mistral	\N
52	dolphin-llama3	Dolphin 2.9 is a new model with 8B and 70B sizes by Eric Hartford based on Llama 3 that has a variety of instruction, conversational, and coding skills.	/images/models/llama.png	/library/dolphin-llama3	\N
53	codestral	Codestral is Mistral AI’s first-ever code model designed for code generation tasks.	\N	/library/codestral	\N
54	command-r	Command R is a Large Language Model optimized for conversational interaction and long context tasks.	\N	/library/command-r	\N
55	hermes3	Hermes 3 is the latest version of the flagship Hermes series of LLMs by Nous Research	/images/models/hermes.jpeg	/library/hermes3	\N
56	phi3.5	A lightweight AI model with 3.8 billion parameters with performance overtaking similarly and larger sized models.	/images/models/microsoft.png	/library/phi3.5	\N
57	yi	Yi 1.5 is a high-performing, bilingual language model.	/images/models/yi.png	/library/yi	\N
58	zephyr	Zephyr is a series of fine-tuned versions of the Mistral and Mixtral models that are trained to act as helpful assistants.	\N	/library/zephyr	\N
59	granite3.3	IBM Granite 2B and 8B models are 128K context length language models that have been fine-tuned for improved reasoning and instruction-following capabilities.	/images/models/granite.png	/library/granite3.3	\N
60	phi4-mini	Phi-4-mini brings significant enhancements in multilingual support, reasoning, and mathematics, and now, the long-awaited function calling feature is finally supported.	/images/models/microsoft.png	/library/phi4-mini	\N
61	moondream	moondream2 is a small vision language model designed to run efficiently on edge devices.	\N	/library/moondream	\N
62	granite-code	A family of open foundation models by IBM for Code Intelligence	/images/models/granite.png	/library/granite-code	\N
63	wizard-vicuna-uncensored	Wizard Vicuna Uncensored is a 7B, 13B, and 30B parameter model based on Llama 2 uncensored by Eric Hartford.	/images/models/wizard.png	/library/wizard-vicuna-uncensored	\N
64	starcoder	StarCoder is a code generation model trained on 80+ programming languages.	\N	/library/starcoder	\N
65	devstral	Devstral: the best open source model for coding agents	\N	/library/devstral	\N
66	magistral	Magistral is a small, efficient reasoning model with 24B parameters.	\N	/library/magistral	\N
67	vicuna	General use chat model based on Llama and Llama 2 with 2K to 16K context sizes.	\N	/library/vicuna	\N
68	phi4-reasoning	Phi 4 reasoning and reasoning plus are 14-billion parameter open-weight reasoning models that rival much larger models on complex reasoning tasks.	/images/models/microsoft.png	/library/phi4-reasoning	\N
69	mistral-small3.1	Building upon Mistral Small 3, Mistral Small 3.1 (2503) adds state-of-the-art vision understanding and enhances long context capabilities up to 128k tokens without compromising text performance.	/images/models/mistral.png	/library/mistral-small3.1	\N
70	openchat	A family of open-source models trained on a wide variety of data, surpassing ChatGPT on various benchmarks. Updated to version 3.5-0106.	\N	/library/openchat	\N
71	deepcoder	DeepCoder is a fully open-Source 14B coder model at O3-mini level, with a 1.5B version also available.	\N	/library/deepcoder	\N
72	cogito	Cogito v1 Preview is a family of hybrid reasoning models by Deep Cogito that outperform the best available open models of the same size, including counterparts from LLaMA, DeepSeek, and Qwen across most standard benchmarks.	\N	/library/cogito	\N
73	mistral-openorca	Mistral OpenOrca is a 7 billion parameter model, fine-tuned on top of the Mistral 7B model using the OpenOrca dataset.	/images/models/mistral.png	/library/mistral-openorca	\N
74	codegeex4	A versatile model for AI software development scenarios, including code completion.	\N	/library/codegeex4	\N
75	deepseek-llm	An advanced language model crafted with 2 trillion bilingual tokens.	/images/models/deepseek.png	/library/deepseek-llm	\N
76	deepseek-v2	A strong, economical, and efficient Mixture-of-Experts language model.	/images/models/deepseek.png	/library/deepseek-v2	\N
77	openhermes	OpenHermes 2.5 is a 7B model fine-tuned by Teknium on Mistral with fully open datasets.	/images/models/hermes.jpeg	/library/openhermes	\N
78	codeqwen	CodeQwen1.5 is a large language model pretrained on a large amount of code data.	/images/models/qwen.png	/library/codeqwen	\N
79	mistral-large	Mistral Large 2 is Mistral's new flagship model that is significantly more capable in code generation, mathematics, and reasoning with 128k context window and support for dozens of languages.	/images/models/mistral.png	/library/mistral-large	\N
80	llama2-chinese	Llama 2 based model fine tuned to improve Chinese dialogue ability.	/images/models/llama.png	/library/llama2-chinese	\N
81	granite3.2-vision	A compact and efficient vision-language model, specifically designed for visual document understanding, enabling automated content extraction from tables, charts, infographics, plots, diagrams, and more.	/images/models/granite.png	/library/granite3.2-vision	\N
82	aya	Aya 23, released by Cohere, is a new family of state-of-the-art, multilingual models that support 23 languages.	\N	/library/aya	\N
125	paraphrase-multilingual	Sentence-transformers model that can be used for tasks like clustering or semantic search.	\N	/library/paraphrase-multilingual	\N
83	tinydolphin	An experimental 1.1B parameter model trained on the new Dolphin 2.8 dataset by Eric Hartford and based on TinyLlama.	/images/models/dolphin.png	/library/tinydolphin	\N
84	qwen2-math	Qwen2 Math is a series of specialized math language models built upon the Qwen2 LLMs, which significantly outperforms the mathematical capabilities of open-source models and even closed-source models (e.g., GPT4o).	/images/models/qwen.png	/library/qwen2-math	\N
85	glm4	A strong multi-lingual general language model with competitive performance to Llama 3.	\N	/library/glm4	\N
86	stable-code	Stable Code 3B is a coding model with instruct and code completion variants on par with models such as Code Llama 7B that are 2.5x larger.	\N	/library/stable-code	\N
87	nous-hermes2	The powerful family of models by Nous Research that excels at scientific discussion and coding tasks.	/images/models/hermes.jpeg	/library/nous-hermes2	\N
88	wizardcoder	State-of-the-art code generation model	/images/models/wizard.png	/library/wizardcoder	\N
89	command-r-plus	Command R+ is a powerful, scalable large language model purpose-built to excel at real-world enterprise use cases.	\N	/library/command-r-plus	\N
90	bakllava	BakLLaVA is a multimodal model consisting of the Mistral 7B base model augmented with the LLaVA  architecture.	/images/models/llava.png	/library/bakllava	\N
91	neural-chat	A fine-tuned model based on Mistral with good coverage of domain and language.	\N	/library/neural-chat	\N
92	granite3.2	Granite-3.2 is a family of long-context AI models from IBM Granite fine-tuned for thinking capabilities.	/images/models/granite.png	/library/granite3.2	\N
93	stablelm2	Stable LM 2 is a state-of-the-art 1.6B and 12B parameter language model trained on multilingual data in English, Spanish, German, Italian, French, Portuguese, and Dutch.	\N	/library/stablelm2	\N
94	bge-large	Embedding model from BAAI mapping texts to vectors.	\N	/library/bge-large	\N
95	sqlcoder	SQLCoder is a code completion model fined-tuned on StarCoder for SQL generation tasks	\N	/library/sqlcoder	\N
96	llama3-chatqa	A model from NVIDIA based on Llama 3 that excels at conversational question answering (QA) and retrieval-augmented generation (RAG).	/images/models/llama.png	/library/llama3-chatqa	\N
97	reflection	A high-performing model trained with a new technique called Reflection-tuning that teaches a LLM to detect mistakes in its reasoning and correct course.	\N	/library/reflection	\N
98	snowflake-arctic-embed2	Snowflake's frontier embedding model. Arctic Embed 2.0 adds multilingual support without sacrificing English performance or scalability.	\N	/library/snowflake-arctic-embed2	\N
99	wizard-math	Model focused on math and logic problems	/images/models/wizard.png	/library/wizard-math	\N
100	llava-phi3	A new small LLaVA model fine-tuned from Phi 3 Mini.	/images/models/llava.png	/library/llava-phi3	\N
101	granite3.1-dense	The IBM Granite 2B and 8B models are text-only dense LLMs trained on over 12 trillion tokens of data, demonstrated significant improvements over their predecessors in performance and speed in IBM’s initial testing.	/images/models/granite.png	/library/granite3.1-dense	\N
102	granite3-dense	The IBM Granite 2B and 8B models are designed to support tool-based use cases and support for retrieval augmented generation (RAG), streamlining code generation, translation and bug fixing.	/images/models/granite.png	/library/granite3-dense	\N
103	llama3-gradient	This model extends LLama-3 8B's context length from 8k to over 1m tokens.	/images/models/llama.png	/library/llama3-gradient	\N
104	dbrx	DBRX is an open, general-purpose LLM created by Databricks.	\N	/library/dbrx	\N
105	nous-hermes	General use models based on Llama and Llama 2 from Nous Research.	/images/models/hermes.jpeg	/library/nous-hermes	\N
106	exaone3.5	EXAONE 3.5 is a collection of instruction-tuned bilingual (English and Korean) generative models ranging from 2.4B to 32B parameters, developed and released by LG AI Research.	\N	/library/exaone3.5	\N
107	samantha-mistral	A companion assistant trained in philosophy, psychology, and personal relationships. Based on Mistral.	/images/models/mistral.png	/library/samantha-mistral	\N
108	yi-coder	Yi-Coder is a series of open-source code language models that delivers state-of-the-art coding performance with fewer than 10 billion parameters.	/images/models/yi.png	/library/yi-coder	\N
109	dolphincoder	A 7B and 15B uncensored variant of the Dolphin model family that excels at coding, based on StarCoder2.	/images/models/dolphin.png	/library/dolphincoder	\N
110	nemotron-mini	A commercial-friendly small language model by NVIDIA optimized for roleplay, RAG QA, and function calling.	\N	/library/nemotron-mini	\N
111	starling-lm	Starling is a large language model trained by reinforcement learning from AI feedback focused on improving chatbot helpfulness.	\N	/library/starling-lm	\N
112	phind-codellama	Code generation model based on Code Llama.	/images/models/llama.png	/library/phind-codellama	\N
113	solar	A compact, yet powerful 10.7B large language model designed for single-turn conversation.	\N	/library/solar	\N
114	xwinlm	Conversational model based on Llama 2 that performs competitively on various benchmarks.	\N	/library/xwinlm	\N
115	falcon	A large language model built by the Technology Innovation Institute (TII) for use in summarization, text generation, and chat bots.	\N	/library/falcon	\N
116	internlm2	InternLM2.5 is a 7B parameter model tailored for practical scenarios with outstanding reasoning capability.	\N	/library/internlm2	\N
117	deepscaler	A fine-tuned version of Deepseek-R1-Distilled-Qwen-1.5B that surpasses the performance of OpenAI’s o1-preview with just 1.5B parameters on popular math evaluations.	\N	/library/deepscaler	\N
118	athene-v2	Athene-V2 is a 72B parameter model which excels at code completion, mathematics, and log extraction tasks.	\N	/library/athene-v2	\N
119	nemotron	Llama-3.1-Nemotron-70B-Instruct is a large language model customized by NVIDIA to improve the helpfulness of LLM generated responses to user queries.	\N	/library/nemotron	\N
120	yarn-llama2	An extension of Llama 2 that supports a context of up to 128k tokens.	/images/models/llama.png	/library/yarn-llama2	\N
121	dolphin-phi	2.7B uncensored Dolphin model by Eric Hartford, based on the Phi language model by Microsoft Research.	/images/models/dolphin.png	/library/dolphin-phi	\N
122	llama3-groq-tool-use	A series of models from Groq that represent a significant advancement in open-source AI capabilities for tool use/function calling.	/images/models/llama.png	/library/llama3-groq-tool-use	\N
123	opencoder	OpenCoder is an open and reproducible code LLM family which includes 1.5B and 8B models, supporting chat in English and Chinese languages.	\N	/library/opencoder	\N
124	wizardlm	General use model based on Llama 2.	/images/models/wizard.png	/library/wizardlm	\N
126	exaone-deep	EXAONE Deep exhibits superior capabilities in various reasoning tasks including math and coding benchmarks, ranging from 2.4B to 32B parameters developed and released by LG AI Research.	\N	/library/exaone-deep	\N
127	wizardlm-uncensored	Uncensored version of Wizard LM model	/images/models/wizard.png	/library/wizardlm-uncensored	\N
128	orca2	Orca 2 is built by Microsoft research, and are a fine-tuned version of Meta's Llama 2 models.  The model is designed to excel particularly in reasoning.	\N	/library/orca2	\N
129	aya-expanse	Cohere For AI's language models trained to perform well across 23 different languages.	\N	/library/aya-expanse	\N
130	smallthinker	A new small reasoning model fine-tuned from the Qwen 2.5 3B Instruct model.	\N	/library/smallthinker	\N
131	falcon3	A family of efficient AI models under 10B parameters performant in science, math, and coding through innovative training techniques.	\N	/library/falcon3	\N
132	llama-guard3	Llama Guard 3 is a series of models fine-tuned for content safety classification of LLM inputs and responses.	/images/models/llama.png	/library/llama-guard3	\N
133	granite-embedding	The IBM Granite Embedding 30M and 278M models models are text-only dense biencoder embedding models, with 30M available in English only and 278M serving multilingual use cases.	/images/models/granite.png	/library/granite-embedding	\N
134	medllama2	Fine-tuned Llama 2 model to answer medical questions based on an open source medical dataset.	/images/models/llama.png	/library/medllama2	\N
135	nous-hermes2-mixtral	The Nous Hermes 2 model from Nous Research, now trained over Mixtral.	/images/models/hermes.jpeg	/library/nous-hermes2-mixtral	\N
136	stable-beluga	Llama 2 based model fine tuned on an Orca-style dataset. Originally called Free Willy.	\N	/library/stable-beluga	\N
137	meditron	Open-source medical large language model adapted from Llama 2 to the medical domain.	\N	/library/meditron	\N
138	granite3-moe	The IBM Granite 1B and 3B models are the first mixture of experts (MoE) Granite models from IBM designed for low latency usage.	/images/models/granite.png	/library/granite3-moe	\N
139	deepseek-v2.5	An upgraded version of DeekSeek-V2  that integrates the general and coding abilities of both DeepSeek-V2-Chat and DeepSeek-Coder-V2-Instruct.	/images/models/deepseek.png	/library/deepseek-v2.5	\N
140	r1-1776	A version of the DeepSeek-R1 model that has been post trained to provide unbiased, accurate, and factual information by Perplexity.	\N	/library/r1-1776	\N
141	granite3.1-moe	The IBM Granite 1B and 3B models are long-context mixture of experts (MoE) Granite models from IBM designed for low latency usage.	/images/models/granite.png	/library/granite3.1-moe	\N
142	reader-lm	A series of models that convert HTML content to Markdown content, which is useful for content conversion tasks.	\N	/library/reader-lm	\N
143	llama-pro	An expansion of Llama 2 that specializes in integrating both general language understanding and domain-specific knowledge, particularly in programming and mathematics.	/images/models/llama.png	/library/llama-pro	\N
144	yarn-mistral	An extension of Mistral to support context windows of 64K or 128K.	/images/models/mistral.png	/library/yarn-mistral	\N
145	shieldgemma	ShieldGemma is set of instruction tuned models for evaluating the safety of text prompt input and text output responses against a set of defined safety policies.	/images/models/gemma.png	/library/shieldgemma	\N
146	nexusraven	Nexus Raven is a 13B instruction tuned model for function calling tasks.	\N	/library/nexusraven	\N
147	command-r7b	The smallest model in Cohere's R series delivers top-tier speed, efficiency, and quality to build powerful AI applications on commodity GPUs and edge devices.	\N	/library/command-r7b	\N
148	mistral-small3.2	An update to Mistral Small that improves on function calling, instruction following, and less repetition errors.	/images/models/mistral.png	/library/mistral-small3.2	\N
149	mathstral	MathΣtral: a 7B model designed for math reasoning and scientific discovery by Mistral AI.	\N	/library/mathstral	\N
150	everythinglm	Uncensored Llama2 based model with support for a 16K context window.	\N	/library/everythinglm	\N
151	codeup	Great code generation model based on Llama2.	\N	/library/codeup	\N
152	marco-o1	An open large reasoning model for real-world solutions by the Alibaba International Digital Commerce Group (AIDC-AI).	\N	/library/marco-o1	\N
153	stablelm-zephyr	A lightweight chat model allowing accurate, and responsive output without requiring high-end hardware.	\N	/library/stablelm-zephyr	\N
154	tulu3	Tülu 3 is a leading instruction following model family, offering fully open-source data, code, and recipes by the The Allen Institute for AI.	\N	/library/tulu3	\N
155	solar-pro	Solar Pro Preview: an advanced large language model (LLM) with 22 billion parameters designed to fit into a single GPU	\N	/library/solar-pro	\N
156	duckdb-nsql	7B parameter text-to-SQL model made by MotherDuck and Numbers Station.	\N	/library/duckdb-nsql	\N
157	falcon2	Falcon2 is an 11B parameters causal decoder-only model built by TII and trained over 5T tokens.	\N	/library/falcon2	\N
158	phi4-mini-reasoning	Phi 4 mini reasoning is a lightweight open model that balances efficiency with advanced reasoning ability.	/images/models/microsoft.png	/library/phi4-mini-reasoning	\N
159	magicoder	🎩 Magicoder is a family of 7B parameter models trained on 75K synthetic instruction data using OSS-Instruct, a novel approach to enlightening LLMs with open-source code snippets.	/images/models/magicoder.png	/library/magicoder	\N
160	mistrallite	MistralLite is a fine-tuned model based on Mistral with enhanced capabilities of processing long contexts.	/images/models/mistral.png	/library/mistrallite	\N
161	codebooga	A high-performing code instruct model created by merging two existing code models.	\N	/library/codebooga	\N
162	bespoke-minicheck	A state-of-the-art fact-checking model developed by Bespoke Labs.	\N	/library/bespoke-minicheck	\N
163	wizard-vicuna	Wizard Vicuna is a 13B parameter model based on Llama 2 trained by MelodysDreamj.	/images/models/wizard.png	/library/wizard-vicuna	\N
164	nuextract	A 3.8B model fine-tuned on a private high-quality synthetic dataset for information extraction, based on Phi-3.	\N	/library/nuextract	\N
165	granite3-guardian	The IBM Granite Guardian 3.0 2B and 8B models are designed to detect risks in prompts and/or responses.	/images/models/granite.png	/library/granite3-guardian	\N
166	megadolphin	MegaDolphin-2.2-120b is a transformation of Dolphin-2.2-70b created by interleaving the model with itself.	/images/models/dolphin.png	/library/megadolphin	\N
167	notux	A top-performing mixture of experts model, fine-tuned with high-quality data.	\N	/library/notux	\N
168	open-orca-platypus2	Merge of the Open Orca OpenChat model and the Garage-bAInd Platypus 2 model. Designed for chat and code generation.	\N	/library/open-orca-platypus2	\N
169	notus	A 7B chat model fine-tuned with high-quality data and based on Zephyr.	\N	/library/notus	\N
170	goliath	A language model created by combining two fine-tuned Llama 2 70B models into one.	\N	/library/goliath	\N
171	command-a	111 billion parameter model optimized for demanding enterprises that require fast, secure, and high-quality AI	\N	/library/command-a	\N
172	sailor2	Sailor2 are multilingual language models made for South-East Asia. Available in 1B, 8B, and 20B parameter sizes.	\N	/library/sailor2	\N
173	firefunction-v2	An open weights function calling model based on Llama 3, competitive with GPT-4o function calling capabilities.	\N	/library/firefunction-v2	\N
174	alfred	A robust conversational model designed to be used for both chat and instruct use cases.	\N	/library/alfred	\N
175	command-r7b-arabic	A new state-of-the-art version of the lightweight Command R7B model that excels in advanced Arabic language capabilities for enterprises in the Middle East and Northern Africa.	\N	/library/command-r7b-arabic	\N
\.


--
-- Data for Name: models; Type: TABLE DATA; Schema: public; Owner: react
--

COPY models (id, family_id, name, size, context, input_type) FROM stdin;
1	1	deepseek-r1:latest	5.2GB	128K	Text
2	1	deepseek-r1:1.5b	1.1GB	128K	Text
3	1	deepseek-r1:7b	4.7GB	128K	Text
4	1	deepseek-r1:8b	5.2GB	128K	Text
5	1	deepseek-r1:14b	9.0GB	128K	Text
6	1	deepseek-r1:32b	20GB	128K	Text
7	1	deepseek-r1:70b	43GB	128K	Text
8	1	deepseek-r1:671b	404GB	160K	Text
9	2	gemma3n:latest	7.5GB	32K	Text
10	2	gemma3n:e2b	5.6GB	32K	Text
11	2	gemma3n:e4b	7.5GB	32K	Text
12	3	gemma3:latest	3.3GB	128K	Text, Image
13	3	gemma3:1b	815MB	32K	Text
14	3	gemma3:4b	3.3GB	128K	Text, Image
15	3	gemma3:12b	8.1GB	128K	Text, Image
16	3	gemma3:27b	17GB	128K	Text, Image
17	4	qwen3:latest	5.2GB	40K	Text
18	4	qwen3:0.6b	523MB	40K	Text
19	4	qwen3:1.7b	1.4GB	40K	Text
20	4	qwen3:4b	2.6GB	40K	Text
21	4	qwen3:8b	5.2GB	40K	Text
22	4	qwen3:14b	9.3GB	40K	Text
23	4	qwen3:30b	19GB	40K	Text
24	4	qwen3:32b	20GB	40K	Text
25	4	qwen3:235b	142GB	40K	Text
26	5	qwen2.5vl:latest	6.0GB	125K	Text, Image
27	5	qwen2.5vl:3b	3.2GB	125K	Text, Image
28	5	qwen2.5vl:7b	6.0GB	125K	Text, Image
29	5	qwen2.5vl:32b	21GB	125K	Text, Image
30	5	qwen2.5vl:72b	49GB	125K	Text, Image
31	6	llama3.1:latest	4.9GB	128K	Text
32	6	llama3.1:8b	4.9GB	128K	Text
33	6	llama3.1:70b	43GB	128K	Text
34	6	llama3.1:405b	243GB	128K	Text
35	7	nomic-embed-text:latest	274MB	2K	Text
36	7	nomic-embed-text:v1.5	274MB	2K	Text
37	8	llama3.2:latest	2.0GB	128K	Text
38	8	llama3.2:1b	1.3GB	128K	Text
39	8	llama3.2:3b	2.0GB	128K	Text
40	9	mistral:latest	4.4GB	32K	Text
41	9	mistral:7b	4.4GB	32K	Text
42	10	qwen2.5:latest	4.7GB	32K	Text
43	10	qwen2.5:0.5b	398MB	32K	Text
44	10	qwen2.5:1.5b	986MB	32K	Text
45	10	qwen2.5:3b	1.9GB	32K	Text
46	10	qwen2.5:7b	4.7GB	32K	Text
47	10	qwen2.5:14b	9.0GB	32K	Text
48	10	qwen2.5:32b	20GB	32K	Text
49	10	qwen2.5:72b	47GB	32K	Text
50	11	llama3:latest	4.7GB	8K	Text
51	11	llama3:8b	4.7GB	8K	Text
52	11	llama3:70b	40GB	8K	Text
53	12	llava:latest	4.7GB	32K	Text, Image
54	12	llava:7b	4.7GB	32K	Text, Image
55	12	llava:13b	8.0GB	4K	Text
56	12	llava:34b	20GB	4K	Text
57	13	phi3:latest	2.2GB	128K	Text
58	13	phi3:3.8b	2.2GB	128K	Text
59	13	phi3:14b	7.9GB	4K	Text
60	14	gemma2:latest	5.4GB	8K	Text
61	14	gemma2:2b	1.6GB	8K	Text
62	14	gemma2:9b	5.4GB	8K	Text
63	14	gemma2:27b	16GB	8K	Text
64	15	qwen2.5-coder:latest	4.7GB	32K	Text
65	15	qwen2.5-coder:0.5b	398MB	32K	Text
66	15	qwen2.5-coder:1.5b	986MB	32K	Text
67	15	qwen2.5-coder:3b	1.9GB	32K	Text
68	15	qwen2.5-coder:7b	4.7GB	32K	Text
69	15	qwen2.5-coder:14b	9.0GB	32K	Text
70	15	qwen2.5-coder:32b	20GB	32K	Text
71	16	gemma:latest	5.0GB	8K	Text
72	16	gemma:2b	1.7GB	8K	Text
73	16	gemma:7b	5.0GB	8K	Text
74	17	qwen:latest	2.3GB	32K	Text
75	17	qwen:0.5b	395MB	32K	Text
76	17	qwen:1.8b	1.1GB	32K	Text
77	17	qwen:4b	2.3GB	32K	Text
78	17	qwen:7b	4.5GB	32K	Text
79	17	qwen:14b	8.2GB	32K	Text
80	17	qwen:32b	18GB	32K	Text
81	17	qwen:72b	41GB	32K	Text
82	17	qwen:110b	63GB	32K	Text
83	18	mxbai-embed-large:latest	670MB	512	Text
84	18	mxbai-embed-large:335m	670MB	512	Text
85	19	qwen2:latest	4.4GB	32K	Text
86	19	qwen2:0.5b	352MB	32K	Text
87	19	qwen2:1.5b	935MB	32K	Text
88	19	qwen2:7b	4.4GB	32K	Text
89	19	qwen2:72b	41GB	32K	Text
90	20	llama2:latest	3.8GB	4K	Text
91	20	llama2:7b	3.8GB	4K	Text
92	20	llama2:13b	7.4GB	4K	Text
93	20	llama2:70b	39GB	4K	Text
94	21	phi4:latest	9.1GB	16K	Text
95	21	phi4:14b	9.1GB	16K	Text
96	22	minicpm-v:latest	5.5GB	32K	Text
97	22	minicpm-v:8b	5.5GB	32K	Text
98	23	codellama:latest	3.8GB	16K	Text
99	23	codellama:7b	3.8GB	16K	Text
100	23	codellama:13b	7.4GB	16K	Text
101	23	codellama:34b	19GB	16K	Text
102	23	codellama:70b	39GB	2K	Text
103	24	tinyllama:latest	638MB	2K	Text
104	24	tinyllama:1.1b	638MB	2K	Text
105	25	llama3.3:latest	43GB	128K	Text
106	25	llama3.3:70b	43GB	128K	Text
107	26	llama3.2-vision:latest	7.8GB	128K	Text, Image
108	26	llama3.2-vision:11b	7.8GB	128K	Text, Image
109	26	llama3.2-vision:90b	55GB	128K	Text, Image
110	27	dolphin3:latest	4.9GB	128K	Text
111	27	dolphin3:8b	4.9GB	128K	Text
112	28	mistral-nemo:latest	7.1GB	1000K	Text
113	28	mistral-nemo:12b	7.1GB	1000K	Text
114	29	olmo2:latest	4.5GB	4K	Text
115	29	olmo2:7b	4.5GB	4K	Text
116	29	olmo2:13b	8.4GB	4K	Text
117	30	deepseek-v3:latest	404GB	4K	Text
118	30	deepseek-v3:671b	404GB	4K	Text
119	31	bge-m3:latest	1.2GB	8K	Text
120	31	bge-m3:567m	1.2GB	8K	Text
121	32	qwq:latest	20GB	40K	Text
122	32	qwq:32b	20GB	40K	Text
123	33	mistral-small:latest	14GB	32K	Text
124	33	mistral-small:22b	13GB	128K	Text
125	33	mistral-small:24b	14GB	32K	Text
126	34	llava-llama3:latest	5.5GB	8K	Text, Image
127	34	llava-llama3:8b	5.5GB	8K	Text, Image
128	35	smollm2:latest	1.8GB	8K	Text
129	35	smollm2:135m	271MB	8K	Text
130	35	smollm2:360m	726MB	8K	Text
131	35	smollm2:1.7b	1.8GB	8K	Text
132	36	llama2-uncensored:latest	3.8GB	2K	Text
133	36	llama2-uncensored:7b	3.8GB	2K	Text
134	36	llama2-uncensored:70b	39GB	2K	Text
135	37	mixtral:latest	26GB	32K	Text
136	37	mixtral:8x7b	26GB	32K	Text
137	37	mixtral:8x22b	80GB	64K	Text
138	38	starcoder2:latest	1.7GB	16K	Text
139	38	starcoder2:3b	1.7GB	16K	Text
140	38	starcoder2:7b	4.0GB	16K	Text
141	38	starcoder2:15b	9.1GB	16K	Text
142	39	deepseek-coder-v2:latest	8.9GB	160K	Text
143	39	deepseek-coder-v2:16b	8.9GB	160K	Text
144	39	deepseek-coder-v2:236b	133GB	4K	Text
145	40	all-minilm:latest	46MB	512	Text
146	40	all-minilm:22m	46MB	512	Text
147	40	all-minilm:33m	67MB	512	Text
148	41	deepseek-coder:latest	776MB	16K	Text
149	41	deepseek-coder:1.3b	776MB	16K	Text
150	41	deepseek-coder:6.7b	3.8GB	16K	Text
151	41	deepseek-coder:33b	19GB	16K	Text
152	42	snowflake-arctic-embed:latest	669MB	512	Text
153	42	snowflake-arctic-embed:22m	46MB	512	Text
154	42	snowflake-arctic-embed:33m	67MB	512	Text
155	42	snowflake-arctic-embed:110m	219MB	512	Text
156	42	snowflake-arctic-embed:137m	274MB	2K	Text
157	42	snowflake-arctic-embed:335m	669MB	512	Text
158	43	phi:latest	1.6GB	2K	Text
159	43	phi:2.7b	1.6GB	2K	Text
160	44	codegemma:latest	5.0GB	8K	Text
161	44	codegemma:2b	1.6GB	8K	Text
162	44	codegemma:7b	5.0GB	8K	Text
163	45	dolphin-mixtral:latest	26GB	32K	Text
164	45	dolphin-mixtral:8x7b	26GB	32K	Text
165	45	dolphin-mixtral:8x22b	80GB	64K	Text
166	46	openthinker:latest	4.7GB	32K	Text
167	46	openthinker:7b	4.7GB	32K	Text
168	46	openthinker:32b	20GB	32K	Text
169	47	llama4:latest	67GB	10M	Text, Image
170	47	llama4:16x17b	67GB	10M	Text, Image
171	47	llama4:128x17b	245GB	1M	Text, Image
172	48	orca-mini:latest	2.0GB	2K	Text
173	48	orca-mini:3b	2.0GB	2K	Text
174	48	orca-mini:7b	3.8GB	4K	Text
175	48	orca-mini:13b	7.4GB	4K	Text
176	48	orca-mini:70b	39GB	4K	Text
177	49	wizardlm2:latest	4.1GB	32K	Text
178	49	wizardlm2:7b	4.1GB	32K	Text
179	49	wizardlm2:8x22b	80GB	64K	Text
180	50	smollm:latest	991MB	2K	Text
181	50	smollm:135m	92MB	2K	Text
182	50	smollm:360m	229MB	2K	Text
183	50	smollm:1.7b	991MB	2K	Text
184	51	dolphin-mistral:latest	4.1GB	32K	Text
185	51	dolphin-mistral:7b	4.1GB	32K	Text
186	52	dolphin-llama3:latest	4.7GB	8K	Text
187	52	dolphin-llama3:8b	4.7GB	8K	Text
188	52	dolphin-llama3:70b	40GB	8K	Text
189	53	codestral:latest	13GB	32K	Text
190	53	codestral:22b	13GB	32K	Text
191	54	command-r:latest	19GB	128K	Text
192	54	command-r:35b	19GB	128K	Text
193	55	hermes3:latest	4.7GB	128K	Text
194	55	hermes3:3b	2.0GB	128K	Text
195	55	hermes3:8b	4.7GB	128K	Text
196	55	hermes3:70b	40GB	128K	Text
197	55	hermes3:405b	229GB	128K	Text
198	56	phi3.5:latest	2.2GB	4K	Text
199	56	phi3.5:3.8b	2.2GB	4K	Text
200	57	yi:latest	3.5GB	4K	Text
201	57	yi:6b	3.5GB	4K	Text
202	57	yi:9b	5.0GB	4K	Text
203	57	yi:34b	19GB	4K	Text
204	58	zephyr:latest	4.1GB	32K	Text
205	58	zephyr:7b	4.1GB	32K	Text
206	58	zephyr:141b	80GB	64K	Text
207	59	granite3.3:latest	4.9GB	128K	Text
208	59	granite3.3:2b	1.5GB	128K	Text
209	59	granite3.3:8b	4.9GB	128K	Text
210	60	phi4-mini:latest	2.5GB	128K	Text
211	60	phi4-mini:3.8b	2.5GB	128K	Text
212	61	moondream:latest	1.7GB	2K	Text, Image
213	61	moondream:1.8b	1.7GB	2K	Text, Image
214	62	granite-code:latest	2.0GB	125K	Text
215	62	granite-code:3b	2.0GB	125K	Text
216	62	granite-code:8b	4.6GB	125K	Text
217	62	granite-code:20b	12GB	8K	Text
218	62	granite-code:34b	19GB	8K	Text
219	63	wizard-vicuna-uncensored:latest	3.8GB	2K	Text
220	63	wizard-vicuna-uncensored:7b	3.8GB	2K	Text
221	63	wizard-vicuna-uncensored:13b	7.4GB	2K	Text
222	63	wizard-vicuna-uncensored:30b	18GB	2K	Text
223	64	starcoder:latest	1.8GB	8K	Text
224	64	starcoder:1b	726MB	8K	Text
225	64	starcoder:3b	1.8GB	8K	Text
226	64	starcoder:7b	4.3GB	8K	Text
227	64	starcoder:15b	9.0GB	8K	Text
228	65	devstral:latest	14GB	128K	Text
229	65	devstral:24b	14GB	128K	Text
230	66	magistral:latest	14GB	39K	Text
231	66	magistral:24b	14GB	39K	Text
232	67	vicuna:latest	3.8GB	4K	Text
233	67	vicuna:7b	3.8GB	4K	Text
234	67	vicuna:13b	7.4GB	4K	Text
235	67	vicuna:33b	18GB	2K	Text
236	68	phi4-reasoning:latest	11GB	32K	Text
237	68	phi4-reasoning:14b	11GB	32K	Text
238	69	mistral-small3.1:latest	15GB	128K	Text, Image
239	69	mistral-small3.1:24b	15GB	128K	Text, Image
240	70	openchat:latest	4.1GB	8K	Text
241	70	openchat:7b	4.1GB	8K	Text
242	71	deepcoder:latest	9.0GB	128K	Text
243	71	deepcoder:1.5b	1.1GB	128K	Text
244	71	deepcoder:14b	9.0GB	128K	Text
245	72	cogito:latest	4.9GB	128K	Text
246	72	cogito:3b	2.2GB	128K	Text
247	72	cogito:8b	4.9GB	128K	Text
248	72	cogito:14b	9.0GB	128K	Text
249	72	cogito:32b	20GB	128K	Text
250	72	cogito:70b	43GB	128K	Text
251	73	mistral-openorca:latest	4.1GB	32K	Text
252	73	mistral-openorca:7b	4.1GB	32K	Text
253	74	codegeex4:latest	5.5GB	128K	Text
254	74	codegeex4:9b	5.5GB	128K	Text
255	75	deepseek-llm:latest	4.0GB	4K	Text
256	75	deepseek-llm:7b	4.0GB	4K	Text
257	75	deepseek-llm:67b	38GB	4K	Text
258	76	deepseek-v2:latest	8.9GB	4K	Text
259	76	deepseek-v2:16b	8.9GB	4K	Text
260	76	deepseek-v2:236b	133GB	4K	Text
261	77	openhermes:latest	4.1GB	32K	Text
262	77	openhermes:v2	4.1GB	32K	Text
263	77	openhermes:v2.5	4.1GB	32K	Text
264	78	codeqwen:latest	4.2GB	64K	Text
265	78	codeqwen:7b	4.2GB	64K	Text
266	79	mistral-large:latest	73GB	128K	Text
267	79	mistral-large:123b	73GB	128K	Text
268	80	llama2-chinese:latest	3.8GB	4K	Text
269	80	llama2-chinese:7b	3.8GB	4K	Text
270	80	llama2-chinese:13b	7.4GB	4K	Text
271	81	granite3.2-vision:latest	2.4GB	16K	Text, Image
272	81	granite3.2-vision:2b	2.4GB	16K	Text, Image
273	82	aya:latest	4.8GB	8K	Text
274	82	aya:8b	4.8GB	8K	Text
275	82	aya:35b	20GB	8K	Text
276	83	tinydolphin:latest	637MB	4K	Text
277	83	tinydolphin:1.1b	637MB	4K	Text
278	84	qwen2-math:latest	4.4GB	4K	Text
279	84	qwen2-math:1.5b	935MB	4K	Text
280	84	qwen2-math:7b	4.4GB	4K	Text
281	84	qwen2-math:72b	41GB	4K	Text
282	85	glm4:latest	5.5GB	128K	Text
283	85	glm4:9b	5.5GB	128K	Text
284	86	stable-code:latest	1.6GB	16K	Text
285	86	stable-code:3b	1.6GB	16K	Text
286	87	nous-hermes2:latest	6.1GB	4K	Text
287	87	nous-hermes2:10.7b	6.1GB	4K	Text
288	87	nous-hermes2:34b	19GB	4K	Text
289	88	wizardcoder:latest	3.8GB	16K	Text
290	88	wizardcoder:33b	19GB	16K	Text
291	89	command-r-plus:latest	59GB	128K	Text
292	89	command-r-plus:104b	59GB	128K	Text
293	90	bakllava:latest	4.7GB	32K	Text
294	90	bakllava:7b	4.7GB	32K	Text
295	91	neural-chat:latest	4.1GB	32K	Text
296	91	neural-chat:7b	4.1GB	32K	Text
297	92	granite3.2:latest	4.9GB	128K	Text
298	92	granite3.2:2b	1.5GB	128K	Text
299	92	granite3.2:8b	4.9GB	128K	Text
300	93	stablelm2:latest	983MB	4K	Text
301	93	stablelm2:1.6b	983MB	4K	Text
302	93	stablelm2:12b	7.0GB	4K	Text
303	94	bge-large:latest	671MB	512	Text
304	94	bge-large:335m	671MB	512	Text
305	95	sqlcoder:latest	4.1GB	32K	Text
306	95	sqlcoder:7b	4.1GB	32K	Text
307	95	sqlcoder:15b	9.0GB	8K	Text
308	96	llama3-chatqa:latest	4.7GB	8K	Text
309	96	llama3-chatqa:8b	4.7GB	8K	Text
310	96	llama3-chatqa:70b	40GB	8K	Text
311	97	reflection:latest	40GB	128K	Text
312	97	reflection:70b	40GB	128K	Text
313	98	snowflake-arctic-embed2:latest	1.2GB	8K	Text
314	98	snowflake-arctic-embed2:568m	1.2GB	8K	Text
315	99	wizard-math:latest	4.1GB	32K	Text
316	99	wizard-math:7b	4.1GB	32K	Text
317	99	wizard-math:13b	7.4GB	4K	Text
318	99	wizard-math:70b	39GB	2K	Text
319	100	llava-phi3:latest	2.9GB	4K	Text
320	100	llava-phi3:3.8b	2.9GB	4K	Text
321	101	granite3.1-dense:latest	5.0GB	128K	Text
322	101	granite3.1-dense:2b	1.6GB	128K	Text
323	101	granite3.1-dense:8b	5.0GB	128K	Text
324	102	granite3-dense:latest	1.6GB	4K	Text
325	102	granite3-dense:2b	1.6GB	4K	Text
326	102	granite3-dense:8b	4.9GB	4K	Text
327	103	llama3-gradient:latest	4.7GB	1M	Text
328	103	llama3-gradient:8b	4.7GB	1M	Text
329	103	llama3-gradient:70b	40GB	1M	Text
330	104	dbrx:latest	74GB	32K	Text
331	104	dbrx:132b	74GB	32K	Text
332	105	nous-hermes:latest	3.8GB	4K	Text
333	105	nous-hermes:7b	3.8GB	4K	Text
334	105	nous-hermes:13b	7.4GB	4K	Text
335	106	exaone3.5:latest	4.8GB	32K	Text
336	106	exaone3.5:2.4b	1.6GB	32K	Text
337	106	exaone3.5:7.8b	4.8GB	32K	Text
338	106	exaone3.5:32b	19GB	32K	Text
339	107	samantha-mistral:latest	4.1GB	32K	Text
340	107	samantha-mistral:7b	4.1GB	32K	Text
341	108	yi-coder:latest	5.0GB	128K	Text
342	108	yi-coder:1.5b	866MB	128K	Text
343	108	yi-coder:9b	5.0GB	128K	Text
344	109	dolphincoder:latest	4.2GB	16K	Text
345	109	dolphincoder:7b	4.2GB	16K	Text
346	109	dolphincoder:15b	9.1GB	16K	Text
347	110	nemotron-mini:latest	2.7GB	4K	Text
348	110	nemotron-mini:4b	2.7GB	4K	Text
349	111	starling-lm:latest	4.1GB	8K	Text
350	111	starling-lm:7b	4.1GB	8K	Text
351	112	phind-codellama:latest	19GB	16K	Text
352	112	phind-codellama:34b	19GB	16K	Text
353	113	solar:latest	6.1GB	4K	Text
354	113	solar:10.7b	6.1GB	4K	Text
355	114	xwinlm:latest	3.8GB	4K	Text
356	114	xwinlm:7b	3.8GB	4K	Text
357	114	xwinlm:13b	7.4GB	4K	Text
358	115	falcon:latest	4.2GB	2K	Text
359	115	falcon:7b	4.2GB	2K	Text
360	115	falcon:40b	24GB	2K	Text
361	115	falcon:180b	101GB	2K	Text
362	116	internlm2:latest	4.5GB	32K	Text
363	116	internlm2:1m	4.5GB	256K	Text
364	116	internlm2:1.8b	1.1GB	32K	Text
365	116	internlm2:7b	4.5GB	32K	Text
366	116	internlm2:20b	11GB	32K	Text
367	117	deepscaler:latest	3.6GB	128K	Text
368	117	deepscaler:1.5b	3.6GB	128K	Text
369	118	athene-v2:latest	47GB	32K	Text
370	118	athene-v2:72b	47GB	32K	Text
371	119	nemotron:latest	43GB	128K	Text
372	119	nemotron:70b	43GB	128K	Text
373	120	yarn-llama2:latest	3.8GB	64K	Text
374	120	yarn-llama2:7b	3.8GB	64K	Text
375	120	yarn-llama2:13b	7.4GB	64K	Text
376	121	dolphin-phi:latest	1.6GB	2K	Text
377	121	dolphin-phi:2.7b	1.6GB	2K	Text
378	122	llama3-groq-tool-use:latest	4.7GB	8K	Text
379	122	llama3-groq-tool-use:8b	4.7GB	8K	Text
380	122	llama3-groq-tool-use:70b	40GB	8K	Text
381	123	opencoder:latest	4.7GB	8K	Text
382	123	opencoder:1.5b	1.4GB	4K	Text
383	123	opencoder:8b	4.7GB	8K	Text
384	124	wizardlm:7b-q2_K	2.8GB	2K	Text
385	124	wizardlm:7b-q3_K_S	2.9GB	2K	Text
386	124	wizardlm:7b-q3_K_M	3.3GB	2K	Text
387	125	paraphrase-multilingual:latest	563MB	512	Text
388	125	paraphrase-multilingual:278m	563MB	512	Text
389	126	exaone-deep:latest	4.8GB	32K	Text
390	126	exaone-deep:2.4b	1.6GB	32K	Text
391	126	exaone-deep:7.8b	4.8GB	32K	Text
392	126	exaone-deep:32b	19GB	32K	Text
393	127	wizardlm-uncensored:latest	7.4GB	4K	Text
394	127	wizardlm-uncensored:13b	7.4GB	4K	Text
395	128	orca2:latest	3.8GB	4K	Text
396	128	orca2:7b	3.8GB	4K	Text
397	128	orca2:13b	7.4GB	4K	Text
398	129	aya-expanse:latest	5.1GB	8K	Text
399	129	aya-expanse:8b	5.1GB	8K	Text
400	129	aya-expanse:32b	20GB	8K	Text
401	130	smallthinker:latest	3.6GB	32K	Text
402	130	smallthinker:3b	3.6GB	32K	Text
403	131	falcon3:latest	4.6GB	32K	Text
404	131	falcon3:1b	1.8GB	8K	Text
405	131	falcon3:3b	2.0GB	32K	Text
406	131	falcon3:7b	4.6GB	32K	Text
407	131	falcon3:10b	6.3GB	32K	Text
408	132	llama-guard3:latest	4.9GB	128K	Text
409	132	llama-guard3:1b	1.6GB	128K	Text
410	132	llama-guard3:8b	4.9GB	128K	Text
411	133	granite-embedding:latest	63MB	512	Text
412	133	granite-embedding:30m	63MB	512	Text
413	133	granite-embedding:278m	563MB	512	Text
414	134	medllama2:latest	3.8GB	4K	Text
415	134	medllama2:7b	3.8GB	4K	Text
416	135	nous-hermes2-mixtral:latest	26GB	32K	Text
417	135	nous-hermes2-mixtral:8x7b	26GB	32K	Text
418	136	stable-beluga:latest	3.8GB	4K	Text
419	136	stable-beluga:7b	3.8GB	4K	Text
420	136	stable-beluga:13b	7.4GB	4K	Text
421	136	stable-beluga:70b	39GB	4K	Text
422	137	meditron:latest	3.8GB	2K	Text
423	137	meditron:7b	3.8GB	2K	Text
424	137	meditron:70b	39GB	4K	Text
425	138	granite3-moe:latest	822MB	4K	Text
426	138	granite3-moe:1b	822MB	4K	Text
427	138	granite3-moe:3b	2.1GB	4K	Text
428	139	deepseek-v2.5:latest	133GB	4K	Text
429	139	deepseek-v2.5:236b	133GB	4K	Text
430	140	r1-1776:latest	43GB	128K	Text
431	140	r1-1776:70b	43GB	128K	Text
432	140	r1-1776:671b	404GB	4K	Text
433	141	granite3.1-moe:latest	2.0GB	128K	Text
434	141	granite3.1-moe:1b	1.4GB	128K	Text
435	141	granite3.1-moe:3b	2.0GB	128K	Text
436	142	reader-lm:latest	935MB	250K	Text
437	142	reader-lm:0.5b	352MB	250K	Text
438	142	reader-lm:1.5b	935MB	250K	Text
439	143	llama-pro:latest	4.7GB	4K	Text
440	143	llama-pro:instruct	4.7GB	4K	Text
441	143	llama-pro:text	4.7GB	4K	Text
442	144	yarn-mistral:latest	4.1GB	32K	Text
443	144	yarn-mistral:7b	4.1GB	32K	Text
444	145	shieldgemma:latest	5.8GB	8K	Text
445	145	shieldgemma:2b	1.7GB	8K	Text
446	145	shieldgemma:9b	5.8GB	8K	Text
447	145	shieldgemma:27b	17GB	8K	Text
448	146	nexusraven:latest	7.4GB	16K	Text
449	146	nexusraven:13b	7.4GB	16K	Text
450	147	command-r7b:latest	5.1GB	8K	Text
451	147	command-r7b:7b	5.1GB	8K	Text
452	148	mistral-small3.2:latest	15GB	128K	Text, Image
453	148	mistral-small3.2:24b	15GB	128K	Text, Image
454	149	mathstral:latest	4.1GB	32K	Text
455	149	mathstral:7b	4.1GB	32K	Text
456	150	everythinglm:latest	7.4GB	16K	Text
457	150	everythinglm:13b	7.4GB	16K	Text
458	151	codeup:latest	7.4GB	4K	Text
459	151	codeup:13b	7.4GB	4K	Text
460	152	marco-o1:latest	4.7GB	32K	Text
461	152	marco-o1:7b	4.7GB	32K	Text
462	153	stablelm-zephyr:latest	1.6GB	4K	Text
463	153	stablelm-zephyr:3b	1.6GB	4K	Text
464	154	tulu3:latest	4.9GB	128K	Text
465	154	tulu3:8b	4.9GB	128K	Text
466	154	tulu3:70b	43GB	128K	Text
467	155	solar-pro:latest	13GB	4K	Text
468	155	solar-pro:22b	13GB	4K	Text
469	156	duckdb-nsql:latest	3.8GB	16K	Text
470	156	duckdb-nsql:7b	3.8GB	16K	Text
471	157	falcon2:latest	6.4GB	2K	Text
472	157	falcon2:11b	6.4GB	2K	Text
473	158	phi4-mini-reasoning:latest	3.2GB	128K	Text
474	158	phi4-mini-reasoning:3.8b	3.2GB	128K	Text
475	159	magicoder:latest	3.8GB	16K	Text
476	159	magicoder:7b	3.8GB	16K	Text
477	160	mistrallite:latest	4.1GB	32K	Text
478	160	mistrallite:7b	4.1GB	32K	Text
479	161	codebooga:latest	19GB	16K	Text
480	161	codebooga:34b	19GB	16K	Text
481	162	bespoke-minicheck:latest	4.7GB	32K	Text
482	162	bespoke-minicheck:7b	4.7GB	32K	Text
483	163	wizard-vicuna:latest	7.4GB	2K	Text
484	163	wizard-vicuna:13b	7.4GB	2K	Text
485	164	nuextract:latest	2.2GB	4K	Text
486	164	nuextract:3.8b	2.2GB	4K	Text
487	165	granite3-guardian:latest	2.7GB	8K	Text
488	165	granite3-guardian:2b	2.7GB	8K	Text
489	165	granite3-guardian:8b	5.8GB	8K	Text
490	166	megadolphin:latest	68GB	4K	Text
491	166	megadolphin:120b	68GB	4K	Text
492	167	notux:latest	26GB	32K	Text
493	167	notux:8x7b	26GB	32K	Text
494	168	open-orca-platypus2:latest	7.4GB	4K	Text
495	168	open-orca-platypus2:13b	7.4GB	4K	Text
496	169	notus:latest	4.1GB	32K	Text
497	169	notus:7b	4.1GB	32K	Text
498	170	goliath:latest	66GB	4K	Text
499	171	command-a:latest	67GB	16K	Text
500	171	command-a:111b	67GB	16K	Text
501	172	sailor2:latest	5.2GB	32K	Text
502	172	sailor2:1b	1.1GB	32K	Text
503	172	sailor2:8b	5.2GB	32K	Text
504	172	sailor2:20b	12GB	32K	Text
505	173	firefunction-v2:latest	40GB	8K	Text
506	173	firefunction-v2:70b	40GB	8K	Text
507	174	alfred:latest	24GB	2K	Text
508	174	alfred:40b	24GB	2K	Text
509	175	command-r7b-arabic:latest	5.1GB	16K	Text
510	175	command-r7b-arabic:7b	5.1GB	16K	Text
\.


--
-- Name: assistants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: react
--

SELECT pg_catalog.setval('assistants_id_seq', 44, true);


--
-- Name: model_families_id_seq; Type: SEQUENCE SET; Schema: public; Owner: react
--

SELECT pg_catalog.setval('model_families_id_seq', 175, true);


--
-- Name: models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: react
--

SELECT pg_catalog.setval('models_id_seq', 510, true);


--
-- Name: assistants assistants_pkey; Type: CONSTRAINT; Schema: public; Owner: react
--

ALTER TABLE ONLY assistants
    ADD CONSTRAINT assistants_pkey PRIMARY KEY (id);


--
-- Name: model_families model_families_name_key; Type: CONSTRAINT; Schema: public; Owner: react
--

ALTER TABLE ONLY model_families
    ADD CONSTRAINT model_families_name_key UNIQUE (name);


--
-- Name: model_families model_families_pkey; Type: CONSTRAINT; Schema: public; Owner: react
--

ALTER TABLE ONLY model_families
    ADD CONSTRAINT model_families_pkey PRIMARY KEY (id);


--
-- Name: models models_pkey; Type: CONSTRAINT; Schema: public; Owner: react
--

ALTER TABLE ONLY models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: models models_family_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: react
--

ALTER TABLE ONLY models
    ADD CONSTRAINT models_family_id_fkey FOREIGN KEY (family_id) REFERENCES model_families(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

--- GRANT ALL ON SCHEMA public focusml;


--
-- PostgreSQL database dump complete
--

