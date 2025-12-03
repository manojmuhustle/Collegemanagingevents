import React, { createContext, useContext, useEffect, useState } from 'react';
import { Event, Venue } from '../types';
import * as db from '../services/dbService';

interface DataContextType {
  events: Event[];
  venues: Venue[];
  refreshData: () => void;
}

const DataContext = createContext<DataContextType>({
  events: [],
  venues: [],
  refreshData: () => {},
});

export const useData = () => useContext(DataContext);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);

  const refreshData = () => {
    setEvents(db.getEvents());
    setVenues(db.getVenues());
  };

  useEffect(() => {
    db.initDB();
    refreshData();

    // Listen for storage changes (other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      refreshData();
    };

    // Listen for local changes (same tab)
    const handleLocalChange = () => {
      refreshData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-data-change', handleLocalChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-data-change', handleLocalChange);
    };
  }, []);

  return (
    <DataContext.Provider value={{ events, venues, refreshData }}>
      {children}
    </DataContext.Provider>
  );
};
