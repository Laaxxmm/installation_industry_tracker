# SAB India Tracker — Railway deployment
# Lean Python image; no app dependencies, just the stdlib http server.
FROM python:3.11-slim

WORKDIR /app

# Copy the static demo + the server. Quoted because of the space in the filename.
COPY server.py ./
COPY "SAB India Tracker.html" ./

# Railway injects $PORT at runtime. EXPOSE is documentary only.
ENV PORT=8080
EXPOSE 8080

CMD ["python", "server.py"]
