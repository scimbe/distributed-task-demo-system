	// POST /api/workers/{id}/fail - Worker-Ausfall simulieren (für Demo)
	r.HandleFunc("/api/workers/{id}/fail", func(w http.ResponseWriter, r *http.Request) {
		vars := mux.Vars(r)
		id := vars["id"]
		
		tm.workerMutex.Lock()
		worker, exists := tm.workerStatus[id]
		if exists {
			worker.Status = "FAILING"
			worker.LastSeen = TimeJSON(time.Now().Add(-40 * time.Second)) // 40 Sekunden in der Vergangenheit
			tm.wsHandler.BroadcastWorkerUpdate(worker)
		}
		tm.workerMutex.Unlock()
		
		// Sofortige Überprüfung der Worker-Gesundheit auslösen
		go tm.checkWorkerHealth()
		
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	}).Methods("POST")

	// HTTP-Server starten
	handler := corsMiddleware(r)
	srv := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	// Server im Hintergrund starten
	go func() {
		log.Println("Task-Manager-API gestartet auf :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Fehler beim Starten des Servers: %v", err)
		}
	}()

	// Auf Beendigungssignal warten
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("Server wird heruntergefahren...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server Shutdown fehlgeschlagen: %v", err)
	}
	log.Println("Server erfolgreich beendet")
}