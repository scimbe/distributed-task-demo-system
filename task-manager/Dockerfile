FROM golang:1.18

WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY go.mod go.sum ./
RUN go mod download

# Quellcode kopieren
COPY . .

# Anwendung bauen
RUN go build -o main .

# Ports öffnen
EXPOSE 8080

# Anwendung starten
CMD ["./main"]
