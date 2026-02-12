# This Dockerfile is expected to be used for local development

# Use the official Python image from the Docker Hub
FROM python:3.13-alpine

# Set the working directory in the container
WORKDIR /code

# Install Python dependencies
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Expose port 8000 for the web server
EXPOSE 8000

# Command to run when developing locally
CMD ["fastapi", "dev", "app/main.py", "--host", "0.0.0.0"]
