# Sidecar Backup - 2026-05-27 21:28

This folder preserves the CrewAI/Gemini sidecar version before the app was cleaned back down to the core React/Express workflow.

The active sidecar lived under `agents/` and included:

- `pyproject.toml`
- `.env.example`
- `README.md`
- `app/config.py`
- `app/main.py`
- `app/schemas.py`
- `app/crews/resume_crew.py`
- `app/crews/keyword_crew.py`
- `app/crews/email_crew.py`
- `app/crews/code_cleaner_crew.py`
- `app/crews/parsing.py`
- `app/tools/resume_validator.py`
- `scripts/clean_file.py`

The complete source snapshot for those files is stored in `SIDECAR_SOURCE.md`.
