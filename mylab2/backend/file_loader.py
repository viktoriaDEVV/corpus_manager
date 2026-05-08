import pdfplumber
import docx
import io
from striprtf.striprtf import rtf_to_text
from bs4 import BeautifulSoup


async def load_text(upload_file):
    filename = upload_file.filename.lower()


    content = await upload_file.read()


    file_stream = io.BytesIO(content)

    if filename.endswith(".txt"):
        return content.decode("utf-8")

    if filename.endswith(".html") or filename.endswith(".htm"):
        soup = BeautifulSoup(content, 'html.parser')
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        # Get text content
        text = soup.get_text(separator='\n', strip=True)
        return text

    if filename.endswith(".pdf"):
        text = ""
        with pdfplumber.open(file_stream) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text

    if filename.endswith(".docx"):
        document = docx.Document(file_stream)
        return "\n".join([p.text for p in document.paragraphs])

    if filename.endswith(".rtf"):
        return rtf_to_text(content.decode("utf-8"))

    return ""