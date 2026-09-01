from transformers import pipeline

print("Loading AI Summarizer...")

summarizer = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6",
    device=-1
)

print("AI Summarizer Ready!")


def generate_summary(text):
    words = text.split()

    # Limit very large text for faster CPU processing
    if len(words) > 500:
        text = " ".join(words[:500])

    input_words = len(text.split())

    # Dynamic summary length
    max_length = min(80, max(30, input_words // 2))
    min_length = min(30, max_length - 5)

    result = summarizer(
        text,
        max_length=max_length,
        min_length=min_length,
        do_sample=False,
        num_beams=2
    )

    return result[0]["summary_text"]