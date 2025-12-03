import type { Event, Venue, User, Attendee } from '../types';

const KEYS = {
  EVENTS: 'cmrnxt_events',
  VENUES: 'cmrnxt_venues',
  USERS: 'cmrnxt_users',
};

// Seed Data
const INITIAL_VENUES: Venue[] = [
  { id: 'v1', name: 'Main Auditorium' },
  { id: 'v2', name: 'Mini Auditorium' },
  { id: 'v3', name: 'Seminar Hall 1' },
  { id: 'v4', name: 'Open Air Theatre' },
  { id: 'v5', name: 'Computer Lab 1' },
];

// Helper to trigger sync across tabs and current tab
const notifyChange = () => {
  window.dispatchEvent(new Event('local-data-change'));
};

// --- HELPER FUNCTIONS ---
const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// --- INIT ---
export const initDB = () => {
  if (!localStorage.getItem(KEYS.VENUES)) {
    localStorage.setItem(KEYS.VENUES, JSON.stringify(INITIAL_VENUES));
  }
  if (!localStorage.getItem(KEYS.EVENTS)) {
    localStorage.setItem(KEYS.EVENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.USERS)) {
    localStorage.setItem(KEYS.USERS, JSON.stringify([]));
  }
};

// --- USERS ---
export const getUsers = (): User[] => {
  const str = localStorage.getItem(KEYS.USERS);
  return str ? JSON.parse(str) : [];
};

export const saveUser = (user: User) => {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  notifyChange();
};

export const findUser = (email: string): User | undefined => {
  const users = getUsers();
  // Check hardcoded admin first
  if (email === 'manojmuhustle@gmail.com') {
    return { email, role: 'ADMIN' };
  }
  return users.find(u => u.email === email);
};

// --- VENUES ---
export const getVenues = (): Venue[] => {
  const str = localStorage.getItem(KEYS.VENUES);
  return str ? JSON.parse(str) : INITIAL_VENUES;
};

export const saveVenue = (venue: Venue) => {
  const venues = getVenues();
  venues.push(venue);
  localStorage.setItem(KEYS.VENUES, JSON.stringify(venues));
  notifyChange();
};

export const updateVenue = (venueId: string, newName: string) => {
  const venues = getVenues();
  const index = venues.findIndex(v => v.id === venueId);
  if (index !== -1) {
    venues[index].name = newName;
    localStorage.setItem(KEYS.VENUES, JSON.stringify(venues));
    notifyChange();
  }
};

export const deleteVenue = (id: string) => {
  const venues = getVenues().filter(v => v.id !== id);
  localStorage.setItem(KEYS.VENUES, JSON.stringify(venues));
  notifyChange();
};

// --- EVENTS ---
export const getEvents = (): Event[] => {
  const str = localStorage.getItem(KEYS.EVENTS);
  return str ? JSON.parse(str) : [];
};

export const saveEvent = (event: Event): { success: boolean; error?: string } => {
  const events = getEvents();

  // Conflict Check
  // Filter active events (approved or pending) that are NOT the current event (if editing)
  const conflicting = events.filter(e => 
    e.id !== event.id &&
    e.status !== 'REJECTED' &&
    e.venueId === event.venueId &&
    e.date === event.date
  ).some(e => {
    // Check time overlap
    // (StartA < EndB) and (EndA > StartB)
    return (event.startTime < e.endTime) && (event.endTime > e.startTime);
  });

  if (conflicting) {
    return { success: false, error: 'Venue is already booked for this date and time range.' };
  }

  // If new event
  const existingIndex = events.findIndex(e => e.id === event.id);
  if (existingIndex >= 0) {
    events[existingIndex] = event;
  } else {
    events.push(event);
  }

  localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
  notifyChange();
  return { success: true };
};

export const deleteEvent = (id: string) => {
  const events = getEvents().filter(e => e.id !== id);
  localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
  notifyChange();
};

export const registerForEvent = (eventId: string, attendee: Attendee): { success: boolean; error?: string } => {
  const events = getEvents();
  const eventIndex = events.findIndex(e => e.id === eventId);
  
  if (eventIndex === -1) return { success: false, error: 'Event not found' };
  
  const event = events[eventIndex];
  
  if (event.status !== 'APPROVED') return { success: false, error: 'Event is not open for registration' };
  if (event.attendees.length >= event.maxAttendees) return { success: false, error: 'Event is full' };
  if (event.attendees.some(a => a.email === attendee.email)) return { success: false, error: 'Already registered' };

  event.attendees.push(attendee);
  events[eventIndex] = event;
  
  localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
  notifyChange();
  return { success: true };
};

export const approveRejectEvent = (eventId: string, status: 'APPROVED' | 'REJECTED') => {
  const events = getEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index].status = status;
    localStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
    notifyChange();
  }
};

// --- AVAILABILITY LOGIC ---

// Find free slots for a given venue and date (24 hours)
export const getFreeTimeSlots = (venueId: string, date: string): string[] => {
  const events = getEvents().filter(e => 
    e.venueId === venueId && 
    e.date === date && 
    e.status !== 'REJECTED'
  );
  
  // Sort by start time
  events.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayStart = 0; // 00:00
  const dayEnd = 24 * 60; // 24:00 (1440 mins)
  const slots: string[] = [];
  
  let currentPointer = dayStart;

  events.forEach(e => {
    const start = parseTime(e.startTime);
    const end = parseTime(e.endTime);

    if (start > currentPointer) {
      // Found a gap
      if (start - currentPointer >= 30) { // Minimum 30 min slot
        slots.push(`${formatTime(currentPointer)} - ${formatTime(start)}`);
      }
    }
    currentPointer = Math.max(currentPointer, end);
  });

  // Check gap after last event
  if (dayEnd > currentPointer) {
     if (dayEnd - currentPointer >= 30) {
        slots.push(`${formatTime(currentPointer)} - ${formatTime(dayEnd)}`);
     }
  }

  return slots.length > 0 ? slots : ['No free slots available (24 hrs)'];
};

// Find free dates for a given venue and time range (Next 1 Year)
export const getFreeDates = (venueId: string, startTime: string, endTime: string): string[] => {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const freeDates: string[] = [];
  const events = getEvents();

  // Check next 365 days
  for(let i=1; i<=365; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Check collision for this day
    const conflicting = events.some(e => 
      e.venueId === venueId &&
      e.date === dateStr &&
      e.status !== 'REJECTED' &&
      (parseTime(e.startTime) < end && parseTime(e.endTime) > start)
    );

    if (!conflicting) {
      freeDates.push(dateStr);
    }
  }
  return freeDates.length > 0 ? freeDates : ['No free dates found in next 1 year'];
};