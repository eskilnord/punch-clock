// Employee Form Component - For checking in/out
const EmployeeForm = ({ onLogout }) => {
  // Lägg till en ref för att spåra om komponenten är monterad
  const isMountedRef = React.useRef(true);
  
  const [isRegistered, setIsRegistered] = React.useState(false);
  const [isCheckedIn, setIsCheckedIn] = React.useState(false);
  const [personnummer, setPersonnummer] = React.useState('');
  const [normalizedPersonnummer, setNormalizedPersonnummer] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState('');
  const [showNumpad, setShowNumpad] = React.useState(true);
  const [currentDateTime, setCurrentDateTime] = React.useState(new Date());
  const [currentStatus, setCurrentStatus] = React.useState(null);
  const [pendingRegistration, setPendingRegistration] = React.useState(false);
  const [employeeName, setEmployeeName] = React.useState('');
  const [employeeList, setEmployeeList] = React.useState([]);
  const [loadingEmployees, setLoadingEmployees] = React.useState(true);
  const [requireShiftInfo, setRequireShiftInfo] = React.useState(false);
  const [showShiftForm, setShowShiftForm] = React.useState(false);
  const [shiftInfo, setShiftInfo] = React.useState({
    startTime: '',
    endTime: '',
    breakDuration: '30',
    notes: '',
    quickSelect: ''
  });
  const [commonShifts, setCommonShifts] = React.useState([
    { label: 'Förmiddag (06:00-14:00)', startTime: '06:00', endTime: '14:00', breakTime: 30 },
    { label: 'Dagtid (08:00-17:00)', startTime: '08:00', endTime: '17:00', breakTime: 60 },
    { label: 'Eftermiddag (14:00-22:00)', startTime: '14:00', endTime: '22:00', breakTime: 30 },
    { label: 'Natt (22:00-06:00)', startTime: '22:00', endTime: '06:00', breakTime: 30 }
  ]);
  
  // Sätt isMountedRef till false när komponenten avmonteras
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Update current date and time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (isMountedRef.current) {
        setCurrentDateTime(new Date());
        // Uppdatera även närvarolistan varje minut
        loadEmployeeStatus();
      }
    }, 60000); // Update every 60 seconds
    
    return () => clearInterval(timer);
  }, []);
  
  // Ladda medarbetare och inställningar när komponenten monteras
  React.useEffect(() => {
    loadEmployeeStatus();
    loadSettings();
  }, []);
  
  // Ladda inställningar
  const loadSettings = async () => {
    try {
      console.log("Loading shift settings from database...");
      const requireShift = await dbService.getConfig('requireShiftInfo');
      console.log("Loaded requireShiftInfo:", requireShift);
      const shouldRequireShift = requireShift === 'true';
      
      if (isMountedRef.current) {
        setRequireShiftInfo(shouldRequireShift);
        console.log("Setting requireShiftInfo to:", shouldRequireShift);
        
        // Initialize times to current hour (rounded)
        const now = new Date();
        const currentHour = now.getHours();
        const roundedNow = new Date(now.setMinutes(0, 0, 0));
        const endTime = new Date(roundedNow);
        endTime.setHours(currentHour + 8); // Default 8 hour shift
        
        setShiftInfo({
          ...shiftInfo,
          startTime: roundedNow.toTimeString().substring(0, 5), // HH:MM format
          endTime: endTime.toTimeString().substring(0, 5) // HH:MM format
        });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };
  
  // Välj ett fördefinierat arbetspass
  const selectCommonShift = (shift) => {
    setShiftInfo({
      ...shiftInfo,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakDuration: shift.breakTime.toString()
    });
  };
  
  // Funktion för att ladda medarbetarnas status
  const loadEmployeeStatus = async () => {
    if (!isMountedRef.current) return;
    
    setLoadingEmployees(true);
    try {
      // Hämta alla medarbetare
      const employees = await dbService.getAllEmployees();
      
      if (!isMountedRef.current) return;
      
      // Skapa en array för att hålla närvarostatus
      const statusList = await Promise.all(
        employees.map(async (employee) => {
          try {
            // Hämta senaste stämpling för varje medarbetare
            const latestTimestamp = await dbService.getLatestTimestampByPersonnummer(employee.personnummer);
            
            console.log("Latest timestamp for", employee.personnummer, ":", latestTimestamp);
            
            let status = 'none';
            if (latestTimestamp) {
              // Om checkOutTime finns och inte är null, är personen utstämplad
              status = latestTimestamp.checkOutTime ? 'out' : 'in';
            }
            
            return {
              id: employee.personnummer,
              name: employee.name || `Person ${Math.floor(Math.random() * 10000)}`,
              status: status,
              timestamp: latestTimestamp?.checkInTime || null
            };
          } catch (error) {
            console.error("Error fetching status for employee:", error);
            return {
              id: employee.personnummer,
              name: employee.name || `Person ${Math.floor(Math.random() * 10000)}`,
              status: 'error',
              timestamp: null
            };
          }
        })
      );
      
      if (isMountedRef.current) {
        setEmployeeList(statusList);
      }
    } catch (error) {
      console.error("Error loading employee status:", error);
    } finally {
      if (isMountedRef.current) {
        setLoadingEmployees(false);
      }
    }
  };
  
  // Reset messages when personnummer changes
  React.useEffect(() => {
    setError('');
    setSuccess('');
    
    // Try to normalize the personnummer while user types
    try {
      // Only attempt normalization if input has enough characters
      if (personnummer.length >= 10) {
        const normalized = utils.normalizePersonnummer(personnummer);
        setNormalizedPersonnummer(normalized);
      } else {
        setNormalizedPersonnummer('');
      }
    } catch (err) {
      console.error('Error normalizing personnummer:', err);
      setNormalizedPersonnummer('');
    }
  }, [personnummer]);
  
  // Periodically check if the employee is registered and check status
  React.useEffect(() => {
    if (normalizedPersonnummer) {
      const checkInterval = setInterval(async () => {
        if (isMountedRef.current) {
          await checkStatus(normalizedPersonnummer);
        }
      }, 5000); // Check every 5 seconds
      
      // Initial check
      checkStatus(normalizedPersonnummer);
      
      return () => clearInterval(checkInterval);
    }
  }, [normalizedPersonnummer]);
  
  // Add a digit to personnummer
  const addDigit = (digit) => {
    setPersonnummer(prev => prev + digit);
  };
  
  // Add hyphen to personnummer
  const addHyphen = () => {
    if (!personnummer.includes('-')) {
      setPersonnummer(prev => prev + '-');
    }
  };
  
  // Delete last character from personnummer
  const deleteLastChar = () => {
    setPersonnummer(prev => prev.slice(0, -1));
  };
  
  // Clear personnummer
  const clearPersonnummer = () => {
    setPersonnummer('');
  };
  
  // Toggle numpad visibility
  const toggleNumpad = () => {
    setShowNumpad(prev => !prev);
  };
  
  // Format current date and time
  const formatDateTime = () => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return currentDateTime.toLocaleDateString('sv-SE', options);
  };
  
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    
    console.log("Formatting timestamp:", timestamp, typeof timestamp);
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        console.error("Invalid date from timestamp:", timestamp);
        return '-';
      }
      return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return '-';
    }
  };
  
  // Validate personnummer input
  const handlePersonnummerChange = (e) => {
    const value = e.target.value;
    setPersonnummer(value);
  };
  
  // Handle employee name change
  const handleEmployeeNameChange = (e) => {
    setEmployeeName(e.target.value);
  };
  
  // Handle shift info changes
  const handleShiftInfoChange = (e) => {
    const { name, value } = e.target;
    setShiftInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle quick select of shift type
  const handleQuickSelect = (value) => {
    const now = new Date();
    const currentHour = now.getHours();
    const roundedNow = new Date(now.setMinutes(0, 0, 0));
    let endTime = new Date(roundedNow);
    
    switch(value) {
      case 'morning':
        roundedNow.setHours(6, 0, 0);
        endTime = new Date(roundedNow);
        endTime.setHours(14, 30, 0);
        break;
      case 'day':
        roundedNow.setHours(8, 0, 0);
        endTime = new Date(roundedNow);
        endTime.setHours(16, 30, 0);
        break;
      case 'evening':
        roundedNow.setHours(14, 0, 0);
        endTime = new Date(roundedNow);
        endTime.setHours(22, 30, 0);
        break;
      case 'night':
        roundedNow.setHours(22, 0, 0);
        endTime = new Date(roundedNow);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(6, 30, 0);
        break;
      default:
        // Current time with 8 hour shift
        endTime.setHours(currentHour + 8);
    }
    
    setShiftInfo({
      ...shiftInfo,
      quickSelect: value,
      startTime: roundedNow.toTimeString().substring(0, 5),
      endTime: endTime.toTimeString().substring(0, 5)
    });
  };
  
  // Check the status of the employee
  const checkStatus = async (pnr) => {
    if (!pnr || loading || !isMountedRef.current) return;
    
    try {
      const employee = await dbService.getEmployee(pnr);
      
      if (!isMountedRef.current) return;
      
      if (!employee) {
        setIsRegistered(false);
        setIsCheckedIn(false);
        setName('');
        setStatusMessage('');
        return;
      }
      
      setIsRegistered(true);
      setName(employee.name || '');
      
      // Check if employee is checked in
      const timestamp = await dbService.getLatestTimestamp(pnr);
      
      if (!isMountedRef.current) return;
      
      if (timestamp && !timestamp.checkOutTime) {
        setIsCheckedIn(true);
        const checkInTime = new Date(timestamp.checkInTime);
        const timeString = checkInTime.toLocaleTimeString('sv-SE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        setStatusMessage(`Instämplad ${timeString}`);
      } else {
        setIsCheckedIn(false);
        setStatusMessage('');
      }
    } catch (err) {
      console.error('Error checking status:', err);
    }
  };
  
  // Handle check-in/check-out
  const handleCheckInOut = async (e) => {
    e.preventDefault();
    
    if (!personnummer) {
      setError('Ange personnummer');
      return;
    }
    
    if (!utils.validatePersonnummer(personnummer)) {
      setError('Ogiltigt personnummer format');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const pnr = utils.normalizePersonnummer(personnummer);
      
      // Check if employee exists
      const employee = await dbService.getEmployee(pnr);
      
      if (!isMountedRef.current) return;
      
      if (!employee) {
        // Register new employee if not exists
        await dbService.saveEmployee({
          personnummer: pnr,
          name: '',
          approved: false // Admin needs to approve new employees
        });
        
        if (!isMountedRef.current) return;
        
        setIsRegistered(true);
        setSuccess('Du har registrerats som ny medarbetare. Inväntar godkännande från administratör.');
        setLoading(false);
        return;
      }
      
      if (employee.approved === false) {
        setSuccess('Ditt konto väntar på godkännande. Kontakta administratör.');
        setLoading(false);
        return;
      }
      
      // Check if employee is already checked in
      const timestamp = await dbService.getLatestTimestamp(pnr);
      let extraData = null;
      
      if (!isMountedRef.current) return;
      
      // If shift info is required, validate it
      if (requireShiftInfo && !isCheckedIn) {
        if (!shiftInfo.startTime || !shiftInfo.endTime) {
          setError('Fyll i information om arbetspasset');
          setLoading(false);
          return;
        }
        
        extraData = {
          shiftInfo: {
            ...shiftInfo,
            date: new Date().toISOString().split('T')[0] // Current date
          }
        };
        
        // Reset shift form after check-in
        setShowShiftForm(false);
      }
      
      if (timestamp && !timestamp.checkOutTime) {
        // Check out
        await dbService.saveTimestamp({
          ...timestamp,
          checkOutTime: new Date().toISOString()
        });
        
        if (!isMountedRef.current) return;
        
        setIsCheckedIn(false);
        setStatusMessage('');
        setSuccess('Utstämpling registrerad');
        
        // Uppdatera närvarolistan
        loadEmployeeStatus();
      } else {
        // Check in
        await dbService.saveTimestamp({
          personnummer: pnr,
          checkInTime: new Date().toISOString(),
          checkOutTime: null
        }, extraData);
        
        if (!isMountedRef.current) return;
        
        setIsCheckedIn(true);
        const timeString = new Date().toLocaleTimeString('sv-SE', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        setStatusMessage(`Instämplad ${timeString}`);
        setSuccess('Instämpling registrerad');
        
        // Uppdatera närvarolistan
        loadEmployeeStatus();
      }
      
      // Clear the input after successful check in/out
      setPersonnummer('');
      setNormalizedPersonnummer('');
      
      // Reset shift info
      setShiftInfo({
        ...shiftInfo,
        notes: '',
        quickSelect: ''
      });
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid stämpling');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Shift Form Component
  const ShiftForm = () => (
    <div className="border rounded-lg p-4 bg-gray-50 mb-4">
      <h3 className="text-lg font-medium mb-3">Information om arbetspass</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Snabbval</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => handleQuickSelect('morning')}
            className={`py-2 px-3 border rounded-md ${
              shiftInfo.quickSelect === 'morning' 
                ? 'bg-blue-100 border-blue-500 text-blue-700' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Förmiddag (06-14:30)
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('day')}
            className={`py-2 px-3 border rounded-md ${
              shiftInfo.quickSelect === 'day' 
                ? 'bg-blue-100 border-blue-500 text-blue-700' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Dag (08-16:30)
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('evening')}
            className={`py-2 px-3 border rounded-md ${
              shiftInfo.quickSelect === 'evening' 
                ? 'bg-blue-100 border-blue-500 text-blue-700' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Kväll (14-22:30)
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect('night')}
            className={`py-2 px-3 border rounded-md ${
              shiftInfo.quickSelect === 'night' 
                ? 'bg-blue-100 border-blue-500 text-blue-700' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            Natt (22-06:30)
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
            Starttid
          </label>
          <input
            type="time"
            id="startTime"
            value={shiftInfo.startTime}
            onChange={(e) => setShiftInfo({...shiftInfo, startTime: e.target.value})}
            className="py-2 px-3 border rounded-md w-full"
          />
        </div>
        
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
            Sluttid
          </label>
          <input
            type="time"
            id="endTime"
            value={shiftInfo.endTime}
            onChange={(e) => setShiftInfo({...shiftInfo, endTime: e.target.value})}
            className="py-2 px-3 border rounded-md w-full"
          />
        </div>
      </div>
      
      <div className="mt-4">
        <label htmlFor="breakDuration" className="block text-sm font-medium text-gray-700 mb-1">
          Rast (minuter)
        </label>
        <select
          id="breakDuration"
          value={shiftInfo.breakDuration}
          onChange={(e) => setShiftInfo({...shiftInfo, breakDuration: e.target.value})}
          className="py-2 px-3 border rounded-md w-full"
        >
          <option value="0">Ingen rast</option>
          <option value="15">15 minuter</option>
          <option value="30">30 minuter</option>
          <option value="45">45 minuter</option>
          <option value="60">60 minuter</option>
          <option value="90">90 minuter</option>
        </select>
      </div>
      
      <div className="mt-4">
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Anteckningar (valfritt)
        </label>
        <textarea
          id="notes"
          value={shiftInfo.notes}
          onChange={(e) => setShiftInfo({...shiftInfo, notes: e.target.value})}
          className="py-2 px-3 border rounded-md w-full h-20"
          placeholder="Lägg till information om arbetspasset..."
        ></textarea>
      </div>
    </div>
  );
  
  // Numpad component
  const Numpad = () => (
    <div className="mt-2 bg-gray-100 p-3 rounded-lg">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(number => (
          <button
            key={number}
            onClick={() => addDigit(number.toString())}
            className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-lg font-medium active:bg-gray-200"
            type="button"
          >
            {number}
          </button>
        ))}
        <button
          onClick={addHyphen}
          className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-lg font-medium active:bg-gray-200"
          type="button"
        >
          -
        </button>
        <button
          onClick={() => addDigit('0')}
          className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-lg font-medium active:bg-gray-200"
          type="button"
        >
          0
        </button>
        <button
          onClick={deleteLastChar}
          className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-lg font-medium active:bg-gray-200"
          type="button"
        >
          ⌫
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1">
        <button
          onClick={clearPersonnummer}
          className="bg-red-100 py-2 rounded shadow hover:bg-red-200 text-red-700 active:bg-red-300"
          type="button"
        >
          Rensa
        </button>
      </div>
    </div>
  );
  
  // Presence list component
  const PresenceList = () => (
    <div className="bg-white p-6 rounded-lg shadow-md h-full">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Närvarolista</h3>
      
      {loadingEmployees ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : employeeList.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Inga medarbetare registrerade</p>
      ) : (
        <div className="overflow-y-auto max-h-[500px]">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employeeList.map((employee) => (
                <tr key={employee.id}>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {employee.status === 'in' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Instämplad
                      </span>
                    )}
                    {employee.status === 'out' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Utstämplad
                      </span>
                    )}
                    {employee.status === 'none' && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Ej stämplad
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-sm text-gray-500">
                    {formatTimestamp(employee.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
  
  // Om användaren behöver registreras
  if (pendingRegistration) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Ny medarbetare</h2>
            
            <div className="mb-4 text-center text-gray-600">
              <p className="text-sm">{formatDateTime()}</p>
            </div>
            
            <p className="mb-4 text-gray-700">
              Du är inte registrerad ännu. Fyll i ditt namn för att registrera dig.
            </p>
            
            <div className="mb-4">
              <label htmlFor="personnummer" className="block text-gray-700 mb-2">Personnummer</label>
              <input
                type="text"
                id="personnummer"
                value={personnummer}
                disabled={true}
                className="w-full px-4 py-2 border rounded-md bg-gray-100"
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="name" className="block text-gray-700 mb-2">Ditt namn</label>
              <input
                type="text"
                id="name"
                placeholder="Ditt namn"
                value={employeeName}
                onChange={handleEmployeeNameChange}
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
                autoFocus
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setPendingRegistration(false)}
                className="w-1/2 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md transition duration-200"
                disabled={loading}
              >
                Avbryt
              </button>
              <button
                onClick={handleCheckInOut}
                disabled={loading}
                className="w-1/2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition duration-200"
              >
                {loading ? 'Registrerar...' : 'Registrera & stämpla in'}
              </button>
            </div>
            
            {error && <p className="text-red-500 mt-4">{error}</p>}
          </div>
          
          <PresenceList />
        </div>
      </div>
    );
  }
  
  // Om användaren behöver fylla i arbetspass
  if (showShiftForm) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold mb-4">Information om arbetspass</h3>
            <ShiftForm />
            
            <div className="mt-4 flex space-x-3">
              <button
                onClick={() => setShowShiftForm(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md flex-1"
              >
                Avbryt
              </button>
              <button
                onClick={handleCheckInOut}
                disabled={loading}
                className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md flex-1"
              >
                {loading ? 'Bearbetar...' : 'Stämpla in'}
              </button>
            </div>
          </div>
          <PresenceList />
        </div>
      </div>
    );
  }
  
  // Standardvyn med stämpelklocka och närvarolista
  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Stämpelklocka</h2>
            <button
              onClick={onLogout}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded-md text-sm"
            >
              Admin
            </button>
          </div>
          
          {/* Current Date and Time */}
          <div className="mb-4 text-center text-gray-600">
            <p>{formatDateTime()}</p>
          </div>
          
          {/* Status messages */}
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
              {success}
            </div>
          )}
          
          {/* Input form */}
          <form onSubmit={handleCheckInOut}>
            <div className="mb-4">
              <label htmlFor="personnummer" className="block text-gray-700 mb-1">Personnummer</label>
              <div className="relative">
                <input
                  type="text"
                  id="personnummer"
                  placeholder="ÅÅÅÅMMDD-XXXX"
                  value={personnummer}
                  onChange={(e) => setPersonnummer(e.target.value)}
                  className="w-full px-4 py-3 border rounded-md text-lg"
                  disabled={loading}
                  inputMode="numeric"
                  pattern="[0-9-]*"
                  autoFocus
                />
                <button 
                  onClick={toggleNumpad}
                  className="absolute right-2 top-3 bg-gray-200 p-1 rounded-full hover:bg-gray-300"
                  type="button"
                >
                  {showNumpad ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                  )}
                </button>
              </div>
              
              {normalizedPersonnummer && normalizedPersonnummer !== personnummer && (
                <p className="mt-1 text-sm text-gray-600">
                  Kommer att sparas som: {normalizedPersonnummer}
                </p>
              )}
              
              {/* Show numpad by default */}
              {showNumpad && <Numpad />}
            </div>
            
            {/* Display employee name if registered */}
            {isRegistered && name && (
              <div className="mb-4 p-2 bg-blue-50 rounded">
                <p className="font-semibold">{name}</p>
                {statusMessage && <p className="text-sm text-gray-600">{statusMessage}</p>}
              </div>
            )}
            
            {/* Show shift form if required and user is checking in */}
            {requireShiftInfo && !isCheckedIn && isRegistered && (
              <ShiftForm />
            )}
            
            <button
              type="submit"
              disabled={loading || !personnummer}
              className={`w-full py-3 px-4 rounded-lg text-white font-medium text-lg ${
                isCheckedIn 
                  ? 'bg-red-500 hover:bg-red-600 active:bg-red-700' 
                  : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              } disabled:opacity-50 transition-colors`}
            >
              {loading 
                ? 'Bearbetar...' 
                : isCheckedIn 
                  ? 'Stämpla ut' 
                  : 'Stämpla in'
              }
            </button>
          </form>
        </div>
        
        {/* Närvarolista */}
        <PresenceList />
      </div>
    </div>
  );
};

// Export the component
window.EmployeeForm = EmployeeForm; 