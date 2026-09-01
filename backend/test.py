from dotenv import load_dotenv
import os
from openai import OpenAI

load_dotenv()

api_key = os.getenv("API_KEY")

client = OpenAI(api_key=api_key)

response = client.responses.create(
    model="gpt-5.6",
    input="Explain artificial intelligence in one sentence."
)

print(response.output_text)