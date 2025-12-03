export type Role = 'ADMIN' | 'USER';

export interface User {
  email: string;
  role: Role;
  name?: string; // Optional display name
}

export interface Attendee {
  email: string;
  name: string;
  department: string;
  section: string;
  year: string;
  registeredAt: string; // ISO Date
}

export type EventStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  venueId: string;
  maxAttendees: number;
  poster: string; // Base64 string
  organizerEmail: string;
  status: EventStatus;
  attendees: Attendee[];
  coordinators: string; // Comma separated names
  department: string;
  createdAt: string;
}

export interface Venue {
  id: string;
  name: string;
}

export interface AppState {
  events: Event[];
  venues: Venue[];
  currentUser: User | null;
}

export type View = 
  | 'LOGIN' 
  | 'SIGNUP' 
  | 'HOME' 
  | 'ALL_EVENTS' 
  | 'MY_EVENTS' 
  | 'UPCOMING_EVENTS' 
  | 'PAST_EVENTS' 
  | 'ADMIN_DASHBOARD';
