from fastapi import FastAPI

app = FastAPI(
    title="Home Rental API",
    description="API for managing apartment rentals and reservations",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Home Rental API!"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "home-rental-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)