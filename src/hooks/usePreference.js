import {useEffect, useRef, useState} from 'react';
import {readPreferences, updatePreferences} from '../services/preferences';
export default function usePreference(key, initial) {
  const [value, setValue] = useState(initial);
  const touched = useRef(false);
  useEffect(() => {
    let alive = true;
    readPreferences().then(p => {
      if (alive && !touched.current && typeof p[key] === typeof initial) setValue(p[key]);
    });
    return () => { alive = false; };
  }, [key]);
  return [value, next => {
    touched.current = true;
    setValue(next);
    updatePreferences({[key]:next}).catch(() => {});
  }];
}
