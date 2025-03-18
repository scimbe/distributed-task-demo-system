: %s", redisURL)

	// Verbindung zu RabbitMQ herstellen
	amqpConn, err := amqp.Dial(rabbitmqURL)
	if err != nil {
		log.Fatalf("Fehler beim Verbinden mit RabbitMQ: %v", err)
	}
	defer amqpConn.Close()

	// Worker erstellen
	worker, err := NewWorker(amqpConn, redisURL, workerID)
	if err != nil {
		log.Fatalf("Fehler beim Erstellen des Workers: %v", err)
	}

	// Task-Verarbeitung starten
	if err := worker.StartTaskProcessing(); err != nil {
		log.Fatalf("Fehler beim Starten der Task-Verarbeitung: %v", err)
	}

	log.Printf("Worker gestartet mit ID: %s", worker.ID)

	// Warten auf Beendigungssignal
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Worker wird heruntergefahren...")
	close(worker.shutdownSignal)
	time.Sleep(1 * time.Second) // Zeit zum Aufräumen geben
}