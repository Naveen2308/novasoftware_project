import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { StatusUpdate, ProcessingProgress } from '../models/video.model';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly API_BASE = `${window.location.protocol}//${window.location.hostname}:5000`;

  private statusUpdateSubject = new Subject<StatusUpdate>();
  private progressUpdateSubject = new Subject<ProcessingProgress>();

  // Use a signal for global connection status
  isConnected = signal(false);

  constructor() {
    this.socket = io(this.API_BASE, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected.set(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected.set(false);
    });

    this.socket.on('statusUpdate', (data: StatusUpdate) => {
      this.statusUpdateSubject.next(data);
    });

    this.socket.on('processingProgress', (data: ProcessingProgress) => {
      this.progressUpdateSubject.next(data);
    });
  }

  getStatusUpdates(): Observable<StatusUpdate> {
    return this.statusUpdateSubject.asObservable();
  }

  getProgressUpdates(): Observable<ProcessingProgress> {
    return this.progressUpdateSubject.asObservable();
  }

  getSocket(): Socket {
    return this.socket;
  }
}
