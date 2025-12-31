import pandas as pd
import ollama
import io

class PandasAgent:
    def __init__(self, df: pd.DataFrame, model_name: str = "llama3"):
        self.df = df
        self.model_name = model_name

    def _get_dataframe_context(self):
        buffer = io.StringIO()
        self.df.info(buf=buffer)
        info_str = buffer.getvalue()

        context = (
            f"Here is the dataframe info:\n{info_str}\n\n"
            f"Here are the first 5 rows:\n{self.df.head().to_markdown()}\n"
        )
        return context

    def _sanitize_code(self, llm_response: str) -> str:
        code = llm_response.strip()
        if code.startswith("```python"):
            code = code.split("```python")[1]
        if code.startswith("```"):
            code = code.split("```")[1]
        if code.endswith("```"):
            code = code.rsplit("```", 1)[0]
        return code.strip()

    def ask(self, question: str):
        print(f"Agent is thinking about: '{question}'...")

        context = self._get_dataframe_context()
        prompt = (
            f"You have a pandas DataFrame named `df`.\n"
            f"{context}\n\n"
            f"USER QUESTION: {question}\n\n"
            f"1. Write Python code using pandas to answer the question.\n"
            f"2. Assign the final answer to a variable named `result`.\n"
            f"3. Return ONLY the valid Python code. No explanations, no markdown, no print statements. CODE ONLY - NO COMMENTS!!!"
        )

        try:
            response = ollama.chat(model=self.model_name, messages=[
                {'role': 'user', 'content': prompt},
            ])
            raw_code = response['message']['content']
        except Exception as e:
            return f"Error communicating with Ollama: {e}"

        clean_code = self._sanitize_code(raw_code)

        print(f"Generated Code:\n{'-'*20}\n{clean_code}\n{'-'*20}")

        local_scope = {'df': self.df, 'pd': pd}

        try:
            exec(clean_code, {}, local_scope)

            if 'result' in local_scope:
                return local_scope['result']
            else:
                return "Error: The agent generated code but failed to assign the answer to the variable 'result'."

        except Exception as e:
            return f"Execution Error: {e}\nBad Code:\n{clean_code}"


if __name__ == "__main__":
    # 1. Create Dummy Data
    data = {
        'Date': ['2023-01-01', '2023-01-02', '2023-01-03', '2023-01-04', '2023-01-05', '2023-01-05'],
        'Product': ['Laptop', 'Mouse', 'Keyboard', 'Laptop', 'Monitor', 'Mouse'],
        'Category': ['Electronics', 'Accessories', 'Accessories', 'Electronics', 'Electronics', 'Accessories'],
        'Sales': [1200, 25, 45, 1200, 300, 30],
        'Region': ['North', 'South', 'North', 'West', 'West', 'South']
    }
    df = pd.DataFrame(data)


    agent = PandasAgent(df, model_name="llama3.1:8b")

    print("DataFrame Loaded:")
    print(df.head())
    print("\n" + "="*50 + "\n")

    questions = [
        "What is the total sales revenue?",
        "How many unique products are there?",
        "What is the average sales per category?",
        "Show me the rows where Region is West"
    ]

    for q in questions:
        answer = agent.ask(q)
        print(f"💡 Answer: {answer}\n")