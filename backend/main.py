
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline
from pypdf import PdfReader
from docx import Document
import io

app = FastAPI()

# =========================
# CORS
# =========================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# AI MODEL
# =========================

print("Loading AI Summarizer...")

summarizer = pipeline(
    "summarization",
    model="sshleifer/distilbart-cnn-12-6"
)

print("AI Summarizer Ready!")


# =========================
# REQUEST MODEL
# =========================

class TextRequest(BaseModel):
    text: str
    length: str = "medium"


# =========================
# SUMMARY LENGTH SETTINGS
# =========================

def get_summary_lengths(input_words, length):

    if length == "short":

        max_length = min(
            60,
            max(20, input_words // 4)
        )

        min_length = min(
            20,
            max(8, max_length // 2)
        )

    elif length == "detailed":

        max_length = min(
            150,
            max(60, input_words // 2)
        )

        min_length = min(
            60,
            max(30, max_length // 3)
        )

    else:

        max_length = min(
            100,
            max(30, input_words // 2)
        )

        min_length = min(
            30,
            max(15, max_length // 3)
        )

    if min_length >= max_length:
        min_length = max(5, max_length - 5)

    return max_length, min_length


# =========================
# TEXT CHUNKING
# =========================

def split_into_chunks(text, chunk_size=400):

    words = text.split()

    chunks = []

    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])

        if chunk.strip():
            chunks.append(chunk)

    return chunks


# =========================
# GENERATE SUMMARY
# =========================

def generate_summary(text: str, length="medium"):

    text = text.strip()

    if not text:
        return ""

    words = text.split()

    if len(words) < 30:
        return text

    chunks = split_into_chunks(text, 400)

    summaries = []

    print(
        f"Total words: {len(words)}"
    )

    print(
        f"Total chunks: {len(chunks)}"
    )

    # =========================
    # SUMMARIZE EACH CHUNK
    # =========================

    for index, chunk in enumerate(chunks):

        chunk_words = len(chunk.split())

        print(
            f"Summarizing chunk "
            f"{index + 1}/{len(chunks)} "
            f"(words={chunk_words})"
        )

        max_length, min_length = get_summary_lengths(
            chunk_words,
            length
        )

        try:

            result = summarizer(
                chunk,
                max_length=max_length,
                min_length=min_length,
                do_sample=False
            )

            if result:

                summaries.append(
                    result[0]["summary_text"]
                )

        except Exception as e:

            print(
                f"Chunk {index + 1} error:",
                str(e)
            )

    if not summaries:
        return "Unable to generate summary."

    # =========================
    # COMBINE SUMMARIES
    # =========================

    final_summary = " ".join(summaries)

    return final_summary.strip()


# =========================
# NORMAL TEXT ENDPOINT
# =========================

@app.post("/summarize")
async def summarize(request: TextRequest):

    try:

        text = request.text.strip()

        if not text:

            return {
                "error": "Please enter some text first."
            }

        if len(text.split()) < 30:

            return {
                "error": "Please enter at least 30 words."
            }

        length = request.length.lower()

        if length not in [
            "short",
            "medium",
            "detailed"
        ]:

            length = "medium"

        print(
            f"Text summarization requested: {length}"
        )

        summary = generate_summary(
            text,
            length
        )

        return {
            "summary": summary,
            "length": length
        }

    except Exception as e:

        print(
            "Summarization error:",
            str(e)
        )

        return {
            "error":
                f"Unable to summarize text: {str(e)}"
        }


# =========================
# FILE TEXT EXTRACTION
# =========================

async def extract_text_from_file(
    file: UploadFile
):

    content = await file.read()

    filename = file.filename.lower()

    # =========================
    # TXT
    # =========================

    if filename.endswith(".txt"):

        try:

            return content.decode("utf-8")

        except UnicodeDecodeError:

            return content.decode("latin-1")

    # =========================
    # PDF
    # =========================

    elif filename.endswith(".pdf"):

        try:

            pdf_file = io.BytesIO(content)

            reader = PdfReader(pdf_file)

            print(
                f"PDF contains "
                f"{len(reader.pages)} pages."
            )

            pages_text = []

            for page in reader.pages:

                try:

                    page_text = page.extract_text()

                    if page_text:

                        pages_text.append(
                            page_text
                        )

                except Exception as page_error:

                    print(
                        "PDF page extraction warning:",
                        page_error
                    )

            return "\n".join(
                pages_text
            ).strip()

        except Exception as pdf_error:

            print(
                "PDF extraction error:",
                pdf_error
            )

            raise Exception(
                f"Unable to read PDF file: "
                f"{pdf_error}"
            )

    # =========================
    # DOCX
    # =========================

    elif filename.endswith(".docx"):

        try:

            doc_file = io.BytesIO(content)

            document = Document(doc_file)

            paragraphs = []

            for paragraph in document.paragraphs:

                if paragraph.text.strip():

                    paragraphs.append(
                        paragraph.text
                    )

            return "\n".join(
                paragraphs
            ).strip()

        except Exception as docx_error:

            print(
                "DOCX extraction error:",
                docx_error
            )

            raise Exception(
                f"Unable to read DOCX file: "
                f"{docx_error}"
            )

    else:

        raise Exception(
            "Unsupported file type. "
            "Please upload TXT, PDF or DOCX."
        )


# =========================
# FILE UPLOAD ENDPOINT
# =========================

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...)
):

    try:

        filename = file.filename.lower()

        allowed_extensions = (
            ".txt",
            ".pdf",
            ".docx"
        )

        if not filename.endswith(
            allowed_extensions
        ):

            return {
                "error":
                    "Please upload a TXT, PDF or DOCX file."
            }

        print(
            f"Processing file: "
            f"{file.filename}"
        )

        # =========================
        # EXTRACT TEXT
        # =========================

        text = await extract_text_from_file(
            file
        )

        if not text:

            return {
                "error": (
                    "No readable text was found "
                    "in this file. "
                    "If this is a scanned PDF, "
                    "OCR may be required."
                )
            }

        word_count = len(
            text.split()
        )

        print(
            f"Extracted {word_count} words "
            f"from {file.filename}"
        )

        if word_count < 30:

            return {
                "error": (
                    "The file contains less than "
                    "30 words. Please upload a "
                    "longer document."
                ),
                "original_text": text
            }

        # =========================
        # DEFAULT MEDIUM SUMMARY
        # =========================

        summary = generate_summary(
            text,
            "medium"
        )

        return {
            "original_text": text,
            "summary": summary,
            "length": "medium"
        }

    except Exception as e:

        print(
            "File processing error:",
            str(e)
        )

        return {
            "error":
                f"Unable to process file: {str(e)}"
        }


# =========================
# ROOT
# =========================

@app.get("/")
def home():

    return {
        "message":
            "AI Text Summarizer API is running!",
        "creator":
            "Zunaira Tariq"
    }