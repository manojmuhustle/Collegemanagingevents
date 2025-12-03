import React, { useState, useEffect, createContext, useContext } from 'react';
import { DataProvider, useData } from './contexts/DataContext';
import { User, View, Event, Attendee, Venue } from './types';
import * as db from './services/dbService';
import { Button, Input, Modal, Select, Badge } from './components/UI';

// --- CONSTANTS ---
const ADMIN_EMAIL = 'manojmuhustle@gmail.com';
const ADMIN_PASS = 'Manueventing27@';

// --- AUTH CONTEXT ---
interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  signup: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  currentView: View;
  navigateTo: (view: View) => void;
}
const AuthContext = createContext<AuthContextType>({} as AuthContextType);
const useAuth = () => useContext(AuthContext);

// --- HELPER COMPONENTS ---

const NavBtn: React.FC<{ children: React.ReactNode, active: boolean, onClick: () => void, className?: string }> = ({ children, active, onClick, className = '' }) => (
  <button 
    onClick={onClick}
    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'} ${className}`}
  >
    {children}
  </button>
);

const DashboardCard: React.FC<{ title: string, desc: string, icon: string, onClick: () => void }> = ({ title, desc, icon, onClick }) => (
  <div onClick={onClick} className="bg-slate-800 border border-slate-700 p-6 rounded-xl hover:bg-slate-750 hover:border-brand-primary/50 transition-all cursor-pointer group hover:shadow-lg shadow-sm">
    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-primary transition-colors">{title}</h3>
    <p className="text-slate-400">{desc}</p>
  </div>
);

const LoginForm: React.FC = () => {
  const { login, signup } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = isLogin ? await login(email, pass) : await signup(email, pass);
    if (!success) setError(isLogin ? 'Invalid credentials' : 'Invalid email domain (@cmrit.ac.in only) or user exists');
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
       {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded text-sm text-center">{error}</div>}
       <Input label="Email Address" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="student@cmrit.ac.in" />
       <Input label="Password" type="password" required value={pass} onChange={e => setPass(e.target.value)} />
       <Button type="submit" variant="primary" className="w-full mt-2">{isLogin ? 'Login' : 'Sign Up'}</Button>
       <p className="text-center text-slate-400 text-sm mt-4">
         {isLogin ? "Don't have an account? " : "Already have an account? "}
         <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-brand-primary hover:text-violet-400 font-bold hover:underline">
           {isLogin ? 'Sign Up' : 'Login'}
         </button>
       </p>
    </form>
  );
};

// --- COMPONENT: EVENT FORM ---
const EventForm: React.FC<{ onClose: () => void; eventToEdit?: Event }> = ({ onClose, eventToEdit }) => {
  const { user } = useAuth();
  const { venues, refreshData } = useData();
  const [formData, setFormData] = useState({
    title: eventToEdit?.title || '',
    description: eventToEdit?.description || '',
    department: eventToEdit?.department || '',
    coordinators: eventToEdit?.coordinators || '',
    date: eventToEdit?.date || '',
    startTime: eventToEdit?.startTime || '',
    endTime: eventToEdit?.endTime || '',
    venueId: eventToEdit?.venueId || venues[0]?.id || '',
    maxAttendees: eventToEdit?.maxAttendees || 50,
    poster: eventToEdit?.poster || '',
  });
  const [error, setError] = useState('');
  
  // Availability Modal State
  const [suggestionModal, setSuggestionModal] = useState({ isOpen: false, title: '', items: [] as string[], type: '' as 'TIME' | 'DATE' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, poster: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const checkTimeSlots = () => {
    if (!formData.venueId || !formData.date) return;
    const slots = db.getFreeTimeSlots(formData.venueId, formData.date);
    setSuggestionModal({ isOpen: true, title: `Free Time Slots on ${formData.date} (24H)`, items: slots, type: 'TIME' });
  };

  const checkDates = () => {
    if (!formData.venueId || !formData.startTime || !formData.endTime) return;
    const dates = db.getFreeDates(formData.venueId, formData.startTime, formData.endTime);
    setSuggestionModal({ isOpen: true, title: `Free Dates (Next 1 Year)`, items: dates, type: 'DATE' });
  };

  const handleSuggestionClick = (item: string) => {
    if (suggestionModal.type === 'TIME') {
      // item format "HH:MM - HH:MM"
      if (item.includes('-')) {
        const [start, end] = item.split(' - ');
        setFormData(prev => ({ ...prev, startTime: start, endTime: end }));
      }
    } else {
      // item format "YYYY-MM-DD"
      if (item.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setFormData(prev => ({ ...prev, date: item }));
      }
    }
    setSuggestionModal({ ...suggestionModal, isOpen: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // VALIDATION: Past Date/Time Check
    const now = new Date();
    const eventStart = new Date(`${formData.date}T${formData.startTime}`);

    if (eventStart < now) {
      setError('Event cannot be scheduled in the past.');
      return;
    }

    if (formData.startTime >= formData.endTime) {
       setError('End time must be strictly after start time.');
       return;
    }

    const newEvent: Event = {
      id: eventToEdit?.id || Date.now().toString(),
      ...formData,
      organizerEmail: eventToEdit?.organizerEmail || user.email,
      // If editing, preserve status. If new, Admin gets APPROVED, others PENDING.
      status: eventToEdit ? eventToEdit.status : (user.role === 'ADMIN' ? 'APPROVED' : 'PENDING'),
      attendees: eventToEdit?.attendees || [],
      createdAt: eventToEdit?.createdAt || new Date().toISOString(),
    };

    const res = db.saveEvent(newEvent);
    if (res.success) {
      refreshData();
      onClose();
    } else {
      setError(res.error || 'Failed to save event');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-slate-200">
        {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-lg text-sm">{error}</div>}
        
        <Input label="Event Title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
        
        <div>
          <label className="text-sm font-medium text-slate-300">Description</label>
          <textarea 
            required
            className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-brand-primary outline-none transition-all"
            rows={3}
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Department/Club" required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
          <Input label="Coordinators" placeholder="Jane Doe, John Smith" required value={formData.coordinators} onChange={e => setFormData({...formData, coordinators: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select 
            label="Venue" 
            value={formData.venueId} 
            onChange={e => setFormData({...formData, venueId: e.target.value})}
            options={venues.map(v => ({ value: v.id, label: v.name }))}
          />
          <div className="flex flex-col gap-1">
             <label className="text-sm font-medium text-slate-300">Max Attendees</label>
             <div className="flex items-center gap-3 mt-1">
               <input 
                 type="range" min="10" max="1000" step="5" 
                 className="flex-grow accent-brand-primary h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                 value={formData.maxAttendees}
                 onChange={e => setFormData({...formData, maxAttendees: parseInt(e.target.value)})}
               />
               <input 
                 type="number" min="10" max="1000"
                 className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-center focus:ring-1 focus:ring-brand-primary outline-none"
                 value={formData.maxAttendees}
                 onChange={e => setFormData({...formData, maxAttendees: parseInt(e.target.value)})}
               />
             </div>
          </div>
        </div>

        {/* Date and Availability Check */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DATE INPUT + FIND BUTTON */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-300">Date (Calendar)</label>
            <div className="flex gap-2">
              <input
                type="date"
                required
                min={todayStr}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
              {formData.venueId && formData.date && (
                 <button 
                   type="button"
                   onClick={checkTimeSlots}
                   className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-brand-primary hover:bg-slate-700 hover:text-white transition-colors"
                   title="Find free time slots on this date"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                 </button>
              )}
            </div>
          </div>
          
          {/* START TIME */}
          <div className="flex flex-col gap-1">
             <Input type="time" label="Start Time" required value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
          </div>
          
          {/* END TIME + FIND DATE BUTTON */}
          <div className="flex flex-col gap-1">
             <label className="text-sm font-medium text-slate-300">End Time</label>
             <div className="flex gap-2">
                <input
                  type="time"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                  value={formData.endTime}
                  onChange={e => setFormData({...formData, endTime: e.target.value})}
                />
                {formData.venueId && formData.startTime && formData.endTime && (
                   <button 
                     type="button"
                     onClick={checkDates}
                     className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-brand-secondary hover:bg-slate-700 hover:text-white transition-colors"
                     title="Find free dates for this time"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                   </button>
                )}
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-300">Event Poster (Optional)</label>
          <input type="file" accept="image/*" onChange={handleFileChange} className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-violet-600"/>
          {formData.poster && (
            <div className="mt-2 h-20 w-20 bg-slate-800 rounded overflow-hidden border border-slate-700">
              <img src={formData.poster} alt="Preview" className="h-full w-full object-contain" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">{eventToEdit ? 'Update Event' : 'Create Event'}</Button>
        </div>
      </form>

      {/* Suggestion Modal */}
      <Modal isOpen={suggestionModal.isOpen} onClose={() => setSuggestionModal({...suggestionModal, isOpen: false})} title={suggestionModal.title}>
         <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
           {suggestionModal.items.map((item, idx) => (
             <button 
               key={idx} 
               onClick={() => handleSuggestionClick(item)}
               className="p-2 text-sm text-center bg-slate-800 border border-slate-700 hover:bg-brand-primary hover:text-white hover:border-brand-primary rounded transition-colors text-slate-200"
             >
               {item}
             </button>
           ))}
         </div>
         {suggestionModal.items.length === 0 && <p className="text-slate-500 text-center">No suggestions found.</p>}
      </Modal>
    </>
  );
};

// --- COMPONENT: EVENT CARD ---
const EventCard: React.FC<{ event: Event, variant?: 'default' | 'calendar' }> = ({ event, variant = 'default' }) => {
  const { user } = useAuth();
  const { venues, refreshData } = useData();
  const [showDetails, setShowDetails] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [attendeesModal, setAttendeesModal] = useState(false);
  
  // Registration State
  const [regName, setRegName] = useState('');
  const [regDept, setRegDept] = useState('');
  const [regSection, setRegSection] = useState('');
  const [regYear, setRegYear] = useState('1st Year');
  const [regSem, setRegSem] = useState('1st Semester');
  const [regError, setRegError] = useState('');

  const venueName = venues.find(v => v.id === event.venueId)?.name || 'Unknown Venue';
  const isOrganizer = user?.email === event.organizerEmail;
  const isAdmin = user?.role === 'ADMIN';
  const isRegistered = event.attendees.some(a => a.email === user?.email);
  const isPast = new Date(event.date + 'T' + event.endTime) < new Date();
  const isFull = event.attendees.length >= event.maxAttendees;

  // Organizers can edit their own future events; Admins can edit any event.
  const canEdit = isAdmin || (isOrganizer && !isPast);

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this event?')) {
      db.deleteEvent(event.id);
      refreshData();
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const attendee: Attendee = {
      email: user.email,
      name: regName,
      department: regDept,
      section: regSection,
      year: `${regYear} - ${regSem}`, // Combine Year and Sem
      registeredAt: new Date().toISOString()
    };
    const res = db.registerForEvent(event.id, attendee);
    if (res.success) {
      refreshData();
      setShowRegModal(false);
    } else {
      setRegError(res.error || 'Registration failed');
    }
  };

  // --- RENDERING ---

  // Determine styling for calendar view
  let calendarClasses = "";
  if (variant === 'calendar') {
    if (isPast) {
      calendarClasses = "bg-slate-700 border-slate-600 text-slate-400"; // Gray
    } else if (isRegistered) {
      calendarClasses = "bg-brand-primary/20 border-brand-primary/30 text-brand-primary font-medium"; // Purple
    } else {
      calendarClasses = "bg-brand-secondary/20 border-brand-secondary/30 text-brand-secondary font-medium"; // Pink
    }
  }

  return (
    <>
      {variant === 'calendar' ? (
        <div 
          onClick={() => setShowDetails(true)} 
          className={`text-xs p-1.5 rounded border truncate cursor-pointer hover:shadow-sm mb-1 transition-all ${calendarClasses}`}
          title={event.title}
        >
          <span className="font-bold mr-1">{event.startTime}</span>
          {event.title}
        </div>
      ) : (
        <div 
          className="group relative flex flex-col bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:shadow-lg hover:border-brand-primary/30 transition-all cursor-pointer shadow-sm"
          onClick={() => setShowDetails(true)}
        >
          <div className="h-48 bg-slate-900/50 flex items-center justify-center overflow-hidden border-b border-slate-700 relative">
            {event.poster ? (
              <img src={event.poster} alt={event.title} className="h-full w-full object-contain" />
            ) : (
              <div className="text-slate-600 font-bold text-4xl select-none">CMR NXT</div>
            )}
            <div className="absolute top-2 right-2 flex gap-2">
              <Badge status={event.status} />
            </div>
          </div>
          <div className="p-4 flex flex-col gap-2 flex-grow">
            <h3 className="text-lg font-bold text-slate-100 truncate group-hover:text-brand-primary transition-colors">{event.title}</h3>
            <p className="text-slate-400 text-sm line-clamp-2">{event.description}</p>
            <div className="mt-auto pt-4 flex flex-col gap-1 text-xs text-slate-500 border-t border-slate-700">
              <div className="flex items-center gap-2">
                <span>📅 {event.date}</span>
                <span>⏰ {event.startTime} - {event.endTime}</span>
              </div>
              <div>📍 {venueName}</div>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title={event.title}>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center p-2">
            {event.poster ? (
              <img src={event.poster} alt={event.title} className="max-h-64 object-contain" />
            ) : (
               <div className="h-32 flex items-center justify-center text-slate-600">No Poster</div>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-4">
             <div className="flex flex-wrap gap-2">
               <Badge status={event.status} />
               <span className="px-2 py-0.5 rounded text-xs bg-brand-primary/10 text-brand-primary border border-brand-primary/20 font-medium">
                 {event.department}
               </span>
               {isRegistered && <span className="px-2 py-0.5 rounded text-xs bg-green-900/40 text-green-400 border border-green-700/50">Registered</span>}
             </div>

             <p className="text-slate-300 leading-relaxed">{event.description}</p>
             
             <div className="grid grid-cols-2 gap-4 text-sm text-slate-400 bg-slate-800/50 border border-slate-700/50 p-4 rounded-lg">
                <div><strong className="text-slate-200">Date:</strong> {event.date}</div>
                <div><strong className="text-slate-200">Time:</strong> {event.startTime} - {event.endTime}</div>
                <div><strong className="text-slate-200">Venue:</strong> {venueName}</div>
                <div><strong className="text-slate-200">Coordinators:</strong> {event.coordinators}</div>
                <div><strong className="text-slate-200">Capacity:</strong> {event.attendees.length} / {event.maxAttendees}</div>
                <div><strong className="text-slate-200">Organizer:</strong> {event.organizerEmail}</div>
             </div>

             <div className="mt-4 flex flex-wrap gap-3">
               {(isOrganizer || isAdmin) && (
                 <>
                  {canEdit && <Button variant="primary" onClick={() => setShowEditModal(true)}>Edit Event</Button>}
                  <Button variant="secondary" onClick={() => setAttendeesModal(true)}>View Attendees</Button>
                  <Button variant="danger" onClick={handleDelete}>Delete Event</Button>
                  {isAdmin && event.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button variant="success" onClick={() => { db.approveRejectEvent(event.id, 'APPROVED'); refreshData(); setShowDetails(false); }}>Approve</Button>
                      <Button variant="danger" onClick={() => { db.approveRejectEvent(event.id, 'REJECTED'); refreshData(); setShowDetails(false); }}>Reject</Button>
                    </div>
                  )}
                 </>
               )}
               
               {!isOrganizer && !isAdmin && (
                  isRegistered ? (
                    <Button disabled variant="ghost">You are registered</Button>
                  ) : isFull ? (
                    <Button disabled variant="ghost">Event Full</Button>
                  ) : event.status !== 'APPROVED' ? (
                     <Button disabled variant="ghost">Registration Closed</Button>
                  ) : isPast ? (
                     <Button disabled variant="ghost">Event Ended</Button>
                  ) : (
                    <Button onClick={() => setShowRegModal(true)}>Register Now</Button>
                  )
               )}
               
               {isOrganizer && <span className="text-sm text-brand-secondary self-center font-medium">You are the organizer</span>}
             </div>
          </div>
        </div>
      </Modal>

      {/* EDIT MODAL */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title={`Edit ${event.title}`}>
        <EventForm onClose={() => setShowEditModal(false)} eventToEdit={event} />
      </Modal>

      {/* ATTENDEES MODAL */}
      <Modal isOpen={attendeesModal} onClose={() => setAttendeesModal(false)} title="Registered Attendees">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Dept</th>
                <th className="p-2">Sec</th>
                <th className="p-2">Year</th>
              </tr>
            </thead>
            <tbody>
              {event.attendees.map((att, i) => (
                <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="p-2 font-medium text-white">{att.name}</td>
                  <td className="p-2">{att.email}</td>
                  <td className="p-2">{att.department}</td>
                  <td className="p-2">{att.section}</td>
                  <td className="p-2">{att.year}</td>
                </tr>
              ))}
              {event.attendees.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-slate-500">No attendees yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* REGISTRATION MODAL */}
      <Modal isOpen={showRegModal} onClose={() => setShowRegModal(false)} title={`Register for ${event.title}`}>
        <form onSubmit={handleRegister} className="flex flex-col gap-4 text-slate-200">
          {regError && <div className="text-red-400 text-sm">{regError}</div>}
          <Input label="Full Name" required value={regName} onChange={e => setRegName(e.target.value)} />
          <Input label="Department" required value={regDept} onChange={e => setRegDept(e.target.value)} />
          <Input label="Section" required value={regSection} onChange={e => setRegSection(e.target.value)} />
          
          <div className="grid grid-cols-2 gap-4">
             <Select 
               label="Year" 
               value={regYear} 
               onChange={e => setRegYear(e.target.value)}
               options={[
                 { value: '1st Year', label: '1st Year' },
                 { value: '2nd Year', label: '2nd Year' },
                 { value: '3rd Year', label: '3rd Year' },
                 { value: '4th Year', label: '4th Year' },
               ]}
             />
             <Select 
               label="Semester" 
               value={regSem} 
               onChange={e => setRegSem(e.target.value)}
               options={[
                 { value: '1st Semester', label: '1st Semester' },
                 { value: '2nd Semester', label: '2nd Semester' },
                 { value: '3rd Semester', label: '3rd Semester' },
                 { value: '4th Semester', label: '4th Semester' },
                 { value: '5th Semester', label: '5th Semester' },
                 { value: '6th Semester', label: '6th Semester' },
                 { value: '7th Semester', label: '7th Semester' },
                 { value: '8th Semester', label: '8th Semester' },
               ]}
             />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="ghost" onClick={() => setShowRegModal(false)}>Cancel</Button>
            <Button type="submit">Confirm Registration</Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

// --- MAIN APP CONTENT ---
const AppContent: React.FC = () => {
  const { user, logout, currentView, navigateTo } = useAuth();
  const { events, venues, refreshData } = useData();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  
  // Admin Editing Venue State
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editingVenueName, setEditingVenueName] = useState('');

  // Calendar State
  const [calendarView, setCalendarView] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());

  if (!user) {
    return (
       <div className="min-h-screen flex items-center justify-center p-4">
         <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md p-8 rounded-2xl border border-slate-700 shadow-2xl">
           <div className="text-center mb-8">
             <h1 className="text-4xl font-bold bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">CMR NXT</h1>
             <p className="text-slate-400 mt-2">Your own college events</p>
           </div>
           <LoginForm />
         </div>
       </div>
    );
  }

  // --- FILTERS ---
  const myEvents = events.filter(e => e.organizerEmail === user.email);
  const upcomingRegistered = events.filter(e => 
    e.attendees.some(a => a.email === user.email) && 
    new Date(e.date + 'T' + e.endTime) >= new Date()
  );
  const pastRegistered = events.filter(e => 
    e.attendees.some(a => a.email === user.email) && 
    new Date(e.date + 'T' + e.endTime) < new Date()
  );
  const allApproved = events.filter(e => e.status === 'APPROVED');
  const allEventsForAdmin = events;

  // --- VENUE MANAGEMENT (ADMIN) ---
  const handleAddVenue = () => {
    if (newVenueName.trim()) {
      db.saveVenue({ id: Date.now().toString(), name: newVenueName });
      setNewVenueName('');
      refreshData();
    }
  };

  const handleUpdateVenue = (id: string) => {
    if (editingVenueName.trim()) {
      db.updateVenue(id, editingVenueName);
      setEditingVenueId(null);
      setEditingVenueName('');
      refreshData();
    }
  };

  const startEditingVenue = (venue: Venue) => {
    setEditingVenueId(venue.id);
    setEditingVenueName(venue.name);
  };

  // --- CALENDAR LOGIC ---
  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Empty cells for padding
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`pad-${i}`} className="h-24 bg-slate-900/30 border border-slate-800/50"></div>);
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daysEvents = events.filter(e => e.date === dateStr && e.status === 'APPROVED');
      
      days.push(
        <div key={d} className="min-h-24 bg-slate-800 border border-slate-700 p-1 flex flex-col gap-1 overflow-hidden">
          <div className="text-right text-sm text-slate-500 font-bold mb-1">{d}</div>
          {daysEvents.map(e => (
            <EventCard key={e.id} event={e} variant="calendar" />
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
           <Button variant="ghost" onClick={() => setCalendarDate(new Date(year, month - 1))}>Previous</Button>
           <h2 className="text-xl font-bold text-white">{calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
           <Button variant="ghost" onClick={() => setCalendarDate(new Date(year, month + 1))}>Next</Button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-700 rounded-xl overflow-hidden border border-slate-700">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="p-2 text-center font-bold text-slate-400 bg-slate-900">{d}</div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-700 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateTo('HOME')}>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center font-bold text-white">C</div>
            <span className="text-xl font-bold text-slate-100 hidden sm:block">CMR NXT</span>
          </div>
          
          <nav className="flex items-center gap-1 sm:gap-4">
            <NavBtn active={currentView === 'HOME'} onClick={() => navigateTo('HOME')}>Home</NavBtn>
            <NavBtn active={currentView === 'ALL_EVENTS'} onClick={() => navigateTo('ALL_EVENTS')}>All Events</NavBtn>
            <NavBtn active={currentView === 'MY_EVENTS'} onClick={() => navigateTo('MY_EVENTS')}>Organized</NavBtn>
            <NavBtn active={currentView === 'UPCOMING_EVENTS'} onClick={() => navigateTo('UPCOMING_EVENTS')}>Upcoming</NavBtn>
            {user.role === 'ADMIN' && (
              <NavBtn active={currentView === 'ADMIN_DASHBOARD'} onClick={() => navigateTo('ADMIN_DASHBOARD')} className="text-brand-secondary">Admin</NavBtn>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 hidden md:block">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        
        {/* VIEW: HOME */}
        {currentView === 'HOME' && (
          <div className="flex flex-col gap-12">
            <div className="text-center py-12">
              <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-purple-500 to-brand-secondary animate-in slide-in-from-bottom-4 duration-500">
                Next Gen Events
              </h1>
              <p className="mt-4 text-slate-400 text-lg max-w-2xl mx-auto">
                Discover, organize, and participate in the most exciting events happening at CMR Institute of Technology.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DashboardCard 
                title="Organize an Event" 
                desc="Host your own workshop, seminar, or club activity."
                icon="✨"
                onClick={() => setShowCreateModal(true)}
              />
              <DashboardCard 
                title="Explore Events" 
                desc="Browse through all upcoming college activities."
                icon="🚀"
                onClick={() => navigateTo('ALL_EVENTS')}
              />
              <DashboardCard 
                title="Your Events" 
                desc="Manage your registrations and organized events."
                icon="📅"
                onClick={() => navigateTo('UPCOMING_EVENTS')}
              />
            </div>
          </div>
        )}

        {/* VIEW: ALL EVENTS */}
        {currentView === 'ALL_EVENTS' && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">All Events</h2>
              <div className="flex gap-2">
                 <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button onClick={() => setCalendarView(false)} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${!calendarView ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Cards</button>
                    <button onClick={() => setCalendarView(true)} className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${calendarView ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}>Calendar</button>
                 </div>
                 <Button onClick={() => setShowCreateModal(true)}>+ Create Event</Button>
              </div>
            </div>

            {calendarView ? (
               renderCalendar()
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {allApproved.map(e => <EventCard key={e.id} event={e} />)}
                {allApproved.length === 0 && <p className="text-slate-500 col-span-full text-center py-10">No events found.</p>}
              </div>
            )}
          </div>
        )}

        {/* VIEW: MY ORGANIZED EVENTS */}
        {currentView === 'MY_EVENTS' && (
          <div className="flex flex-col gap-6">
             <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">My Organized Events</h2>
              <Button onClick={() => setShowCreateModal(true)}>+ Create Event</Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {myEvents.map(e => <EventCard key={e.id} event={e} />)}
              {myEvents.length === 0 && <p className="text-slate-500 col-span-full text-center py-10">You haven't organized any events yet.</p>}
            </div>
          </div>
        )}

        {/* VIEW: UPCOMING & PAST */}
        {currentView === 'UPCOMING_EVENTS' && (
           <div className="flex flex-col gap-8">
             <div>
                <h2 className="text-2xl font-bold text-white mb-6">Upcoming Registered Events</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcomingRegistered.map(e => <EventCard key={e.id} event={e} />)}
                  {upcomingRegistered.length === 0 && <p className="text-slate-500 py-4">No upcoming events.</p>}
                </div>
             </div>
             
             <div>
                <h2 className="text-2xl font-bold text-white mb-6 border-t border-slate-800 pt-8">Past Events</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 grayscale hover:grayscale-0 transition-all">
                  {pastRegistered.map(e => <EventCard key={e.id} event={e} />)}
                  {pastRegistered.length === 0 && <p className="text-slate-500 py-4">No past events.</p>}
                </div>
             </div>
           </div>
        )}

        {/* VIEW: ADMIN DASHBOARD */}
        {currentView === 'ADMIN_DASHBOARD' && user.role === 'ADMIN' && (
          <div className="flex flex-col gap-8">
            <h2 className="text-3xl font-bold text-white">Admin Dashboard</h2>
            
            {/* PENDING APPROVALS */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
               <h3 className="text-xl font-bold text-slate-200 mb-4">Pending Approvals</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 {allEventsForAdmin.filter(e => e.status === 'PENDING').map(e => <EventCard key={e.id} event={e} />)}
                 {allEventsForAdmin.filter(e => e.status === 'PENDING').length === 0 && <p className="text-slate-500">No pending approvals.</p>}
               </div>
            </div>

            {/* ALL EVENTS MANAGEMENT */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
               <h3 className="text-xl font-bold text-slate-200 mb-4">Manage All Events</h3>
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="p-2">Title</th>
                        <th className="p-2">Organizer</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allEventsForAdmin.map(e => (
                        <tr key={e.id} className="border-b border-slate-800">
                           <td className="p-2 font-medium">{e.title}</td>
                           <td className="p-2">{e.organizerEmail}</td>
                           <td className="p-2">{e.date}</td>
                           <td className="p-2"><Badge status={e.status} /></td>
                           <td className="p-2">
                             <Button size="sm" variant="ghost" onClick={() => { 
                               if(confirm('Delete event?')) { db.deleteEvent(e.id); refreshData(); }
                             }}>Delete</Button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>

            {/* VENUE MANAGEMENT */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
               <h3 className="text-xl font-bold text-slate-200 mb-4">Manage Venues</h3>
               <div className="flex gap-2 mb-4">
                 <Input placeholder="New Venue Name" value={newVenueName} onChange={e => setNewVenueName(e.target.value)} />
                 <Button onClick={handleAddVenue}>Add Venue</Button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {venues.map(v => (
                   <div key={v.id} className="flex justify-between items-center bg-slate-900 p-3 rounded border border-slate-700">
                     {editingVenueId === v.id ? (
                        <div className="flex gap-2 flex-1 mr-2">
                          <input 
                            className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                            value={editingVenueName}
                            onChange={e => setEditingVenueName(e.target.value)}
                          />
                          <button onClick={() => handleUpdateVenue(v.id)} className="text-green-400 hover:text-green-300">✓</button>
                          <button onClick={() => setEditingVenueId(null)} className="text-red-400 hover:text-red-300">✕</button>
                        </div>
                     ) : (
                        <span className="text-slate-300 font-medium">{v.name}</span>
                     )}
                     
                     {!editingVenueId && (
                       <div className="flex gap-2">
                         <button onClick={() => startEditingVenue(v)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                         <button onClick={() => { if(confirm('Delete venue?')) { db.deleteVenue(v.id); refreshData(); } }} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
          </div>
        )}

      </main>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Event">
        <EventForm onClose={() => setShowCreateModal(false)} />
      </Modal>

    </div>
  );
};

// --- APP ROOT ---
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>('LOGIN');

  useEffect(() => {
    const saved = localStorage.getItem('cmrnxt_current_user');
    if (saved) {
      setUser(JSON.parse(saved));
      setCurrentView('HOME');
    }
  }, []);

  const login = async (email: string, pass: string) => {
    if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
      const u: User = { email, role: 'ADMIN' };
      setUser(u);
      localStorage.setItem('cmrnxt_current_user', JSON.stringify(u));
      setCurrentView('ADMIN_DASHBOARD');
      return true;
    }
    const found = db.findUser(email);
    if (found) {
      setUser(found);
      localStorage.setItem('cmrnxt_current_user', JSON.stringify(found));
      setCurrentView('HOME');
      return true;
    }
    return false;
  };

  const signup = async (email: string, pass: string) => {
    if (!email.endsWith('@cmrit.ac.in')) return false;
    if (db.findUser(email)) return false;
    const newUser: User = { email, role: 'USER' };
    db.saveUser(newUser);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('cmrnxt_current_user');
    setCurrentView('LOGIN');
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, currentView, navigateTo: setCurrentView }}>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthContext.Provider>
  );
};

export default App;