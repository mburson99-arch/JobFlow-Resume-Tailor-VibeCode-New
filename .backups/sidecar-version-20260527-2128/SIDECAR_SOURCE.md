# Sidecar Source Snapshot

This is a compact source backup of the CrewAI/Gemini sidecar before removing it from the active app.

## agents/pyproject.toml

```toml
[project]
name = "jobflow-agent-service"
version = "0.1.0"
description = "CrewAI sidecar service for JobFlow autonomous workflows."
requires-python = ">=3.10,<3.14"
dependencies = [
  "crewai>=0.86.0",
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "python-dotenv>=1.0.1",
  "pydantic>=2.8.0",
]

[tool.uvicorn]
factory = false
```

## agents/.env.example

```text
AGENT_SERVICE_PORT=8001
AGENT_MODEL=gemini/gemini-2.5-flash
GEMINI_API_KEY=your_gemini_key_here
```

## agents/app/config.py

```python
import os

from crewai import LLM
from dotenv import load_dotenv

load_dotenv()
load_dotenv("../.env")
load_dotenv("../.env.local")


def get_agent_llm() -> LLM:
    """Return the Gemini model used by CrewAI agents."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required to run the CrewAI agent service.")

    return LLM(
        model=os.getenv("AGENT_MODEL", "gemini/gemini-2.5-flash"),
        api_key=api_key,
    )
```

## agents/app/main.py

```python
import os

from fastapi import FastAPI

from app.crews.code_cleaner_crew import run_code_cleaner
from app.crews.email_crew import run_email_classify
from app.crews.keyword_crew import run_keyword_search
from app.crews.resume_crew import run_resume_tailor
from app.schemas import (
    CodeCleanRequest,
    CodeCleanResponse,
    EmailClassifyRequest,
    EmailClassifyResponse,
    HealthResponse,
    KeywordSearchRequest,
    KeywordSearchResponse,
    ResumeTailorRequest,
    ResumeTailorResponse,
)

app = FastAPI(title="JobFlow Agent Service", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        ok=True,
        service="jobflow-agent-service",
        model=os.getenv("AGENT_MODEL", "gemini/gemini-2.5-flash"),
        crews=["resume", "keywords", "email", "code-cleaner"],
    )


@app.post("/crews/resume/tailor", response_model=ResumeTailorResponse)
def tailor_resume(request: ResumeTailorRequest) -> ResumeTailorResponse:
    return run_resume_tailor(request)


@app.post("/crews/keywords/search", response_model=KeywordSearchResponse)
def search_keywords(request: KeywordSearchRequest) -> KeywordSearchResponse:
    return run_keyword_search(request)


@app.post("/crews/email/classify", response_model=EmailClassifyResponse)
def classify_email(request: EmailClassifyRequest) -> EmailClassifyResponse:
    return run_email_classify(request)


@app.post("/crews/code/clean", response_model=CodeCleanResponse)
def clean_code(request: CodeCleanRequest) -> CodeCleanResponse:
    return run_code_cleaner(request)
```

## agents/app/schemas.py

```python
from typing import Any, Literal

from pydantic import BaseModel, Field


class CandidateProfile(BaseModel):
    name: str = "Michael Burson"
    email: str = "mburson99@gmail.com"
    phone: str = "740.755.0345"
    website: str = "https://github.com/mburson99-arch"
    resumeText: str | None = None


class ResumeTailorRequest(BaseModel):
    jobId: str
    resumeText: str
    jobDescription: str
    customInstructions: str | None = None
    currentDraft: str | None = None
    profile: CandidateProfile = Field(default_factory=CandidateProfile)


class ResumeTailorResponse(BaseModel):
    brutallyHonestCritique: str
    tailoredResume: str
    matchScore: int = Field(ge=0, le=100)
    suggestedSkills: list[str]
    estimatedMatchExplanation: str
    requiresRelocation: bool
    aiResponse: str = ""


class KeywordSearchRequest(BaseModel):
    query: str


class KeywordSearchResponse(BaseModel):
    coreKeywords: list[str]
    relatedTitles: list[str]
    booleanStrings: list[str]
    advice: str


class EmailJobCandidate(BaseModel):
    id: str
    title: str
    company: str
    description: str | None = ""


class EmailClassifyRequest(BaseModel):
    fromAddress: str = ""
    subject: str
    bodyText: str
    snippet: str | None = ""
    jobs: list[EmailJobCandidate] = Field(default_factory=list)


class EmailClassifyResponse(BaseModel):
    type: Literal["interview", "rejection", "received", "update"]
    jobId: str | None = None
    confidence: int = Field(ge=0, le=100)
    summary: str
    recommendedStatus: str | None = None


class CodeCleanRequest(BaseModel):
    rawCode: str
    fileName: str | None = None


class CodeCleanResponse(BaseModel):
    audit: str
    cleanedCode: str
    notes: str = ""


class HealthResponse(BaseModel):
    ok: bool
    service: str
    model: str
    crews: list[str]


JsonDict = dict[str, Any]
```

## Notes

The sidecar had four crew modules: resume, keyword, email, and code cleaner. It was intentionally removed from the active app because Python/CrewAI setup became a distraction from the core cleanup goal.
