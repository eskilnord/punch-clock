// Employee Form Component - For checking in/out
const EmployeeForm = () => {
  const [personnummer, setPersonnummer] = React.useState('');
  const [normalizedPersonnummer, setNormalizedPersonnummer] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [currentStatus, setCurrentStatus] = React.useState(null);
  const [currentDateTime, setCurrentDateTime] = React.useState(new Date());
  const [showNumpad, setShowNumpad] = React.useState(true);
  const [pendingRegistration, setPendingRegistration] = React.useState(false);
  const [employeeName, setEmployeeName] = React.useState('');
  const [employeeList, setEmployeeList] = React.useState([]);
  const [loadingEmployees, setLoadingEmployees] = React.useState(true);
  
  // Update current date and time every minute
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
      // Uppdatera även närvarolistan varje minut
      loadEmployeeStatus();
    }, 60000); // Update every 60 seconds
    
    return () => clearInterval(timer);
  }, []);
  
  // Ladda medarbetare när komponenten monteras
  React.useEffect(() => {
    loadEmployeeStatus();
  }, []);
  
  // Funktion för att ladda medarbetarnas status
  const loadEmployeeStatus = async () => {
    setLoadingEmployees(true);
    try {
      // Hämta alla medarbetare
      const employees = await dbService.getAllEmployees();
      
      // Skapa en array för att hålla närvarostatus
      const statusList = await Promise.all(
        employees.map(async (employee) => {
          try {
            // Hämta senaste stämpling för varje medarbetare
            const latestTimestamp = await dbService.getLatestTimestampByPersonnummer(employee.personnummer);
            
            return {
              id: employee.personnummer,
              name: employee.name || `Person ${Math.floor(Math.random() * 10000)}`,
              status: latestTimestamp 
                ? (latestTimestamp.type === 'in' ? 'in' : 'out')
                : 'none',
              timestamp: latestTimestamp?.timestamp || null
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
      
      setEmployeeList(statusList);
    } catch (error) {
      console.error("Error loading employee status:", error);
    } finally {
      setLoadingEmployees(false);
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
    const date = new Date(timestamp);
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
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
  
  // Check employee status and last timestamp
  const checkStatus = async () => {
    if (!utils.validatePersonnummer(personnummer)) {
      setError('Ogiltigt personnummer format. Försök med format som: ÅÅÅÅMMDD-XXXX, ÅÅÅÅMMDDXXXX eller YYMMDDXXXX.');
      return false;
    }
    
    // Use the normalized version for database operations
    const normalizedPnr = utils.normalizePersonnummer(personnummer);
    setLoading(true);
    
    try {
      // Check if employee exists
      const employee = await dbService.getEmployee(normalizedPnr);
      
      if (!employee) {
        // Visa registreringsformulär istället för felmeddelande
        setPendingRegistration(true);
        setLoading(false);
        setPersonnummer(normalizedPnr);
        return false;
      }
      
      // Om medarbetaren finns men inte är godkänd
      if (employee.approved === false) {
        setError('Ditt konto väntar på godkännande från administratören.');
        setLoading(false);
        return false;
      }
      
      // Get latest timestamp
      const latestTimestamp = await dbService.getLatestTimestampByPersonnummer(normalizedPnr);
      
      if (!latestTimestamp || latestTimestamp.type === 'out') {
        setCurrentStatus('out'); // Ready to check in
      } else {
        setCurrentStatus('in'); // Ready to check out
      }
      
      // Update personnummer to normalized format for display
      setPersonnummer(normalizedPnr);
      
      setLoading(false);
      return true;
    } catch (err) {
      console.error(err);
      setError('Ett fel uppstod. Försök igen.');
      setLoading(false);
      return false;
    }
  };
  
  // Handle registration of new employee
  const handleRegisterEmployee = async () => {
    setLoading(true);
    
    try {
      const normalizedPnr = utils.normalizePersonnummer(personnummer);
      
      // Spara medarbetaren med godkänd=false
      await dbService.saveEmployee({
        personnummer: normalizedPnr,
        name: employeeName || '',
        approved: false
      });
      
      // Stämpla in direkt
      await dbService.saveTimestamp(normalizedPnr, 'in');
      
      setSuccess('Du har registrerats och stämplats in! Din registrering väntar på godkännande från administratören.');
      setPendingRegistration(false);
      setCurrentStatus('in');
      
      // Uppdatera närvarolistan
      loadEmployeeStatus();
      
      // Reset after 4 seconds
      setTimeout(() => {
        setSuccess('');
        setPersonnummer('');
        setEmployeeName('');
        setNormalizedPersonnummer('');
        setCurrentStatus(null);
      }, 4000);
    } catch (err) {
      console.error(err);
      setError('Ett fel uppstod vid registrering. Försök igen.');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle check in/out
  const handleCheckInOut = async () => {
    const isValid = await checkStatus();
    
    if (!isValid) return;
    
    setLoading(true);
    
    try {
      const normalizedPnr = utils.normalizePersonnummer(personnummer);
      
      if (currentStatus === 'out') {
        // Check in
        await dbService.saveTimestamp(normalizedPnr, 'in');
        setSuccess('Du är nu instämplad!');
        setCurrentStatus('in');
      } else {
        // Check out
        await dbService.saveTimestamp(normalizedPnr, 'out');
        setSuccess('Du är nu utstämplad!');
        setCurrentStatus('out');
      }
      
      // Uppdatera närvarolistan
      loadEmployeeStatus();
      
      // Reset after 3 seconds
      setTimeout(() => {
        setSuccess('');
        setPersonnummer('');
        setNormalizedPersonnummer('');
        setCurrentStatus(null);
      }, 3000);
    } catch (err) {
      console.error(err);
      setError('Ett fel uppstod vid stämpling. Försök igen.');
    } finally {
      setLoading(false);
    }
  };
  
  // Numpad component
  const Numpad = () => (
    <div className="mt-4 bg-gray-100 p-3 rounded-lg">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(number => (
          <button
            key={number}
            onClick={() => addDigit(number.toString())}
            className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-xl font-medium"
          >
            {number}
          </button>
        ))}
        <button
          onClick={addHyphen}
          className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-xl font-medium"
        >
          -
        </button>
        <button
          onClick={() => addDigit('0')}
          className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-xl font-medium"
        >
          0
        </button>
        <button
          onClick={deleteLastChar}
          className="bg-white py-3 px-4 rounded shadow hover:bg-gray-50 text-xl font-medium"
        >
          ⌫
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1">
        <button
          onClick={clearPersonnummer}
          className="bg-red-100 py-2 rounded shadow hover:bg-red-200 text-red-700"
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
      <div className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto">
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
            onClick={handleRegisterEmployee}
            disabled={loading}
            className="w-1/2 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition duration-200"
          >
            {loading ? 'Registrerar...' : 'Registrera & stämpla in'}
          </button>
        </div>
        
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column - Stamp Clock */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">Stämpelklocka</h2>
        
        {/* Current Date and Time */}
        <div className="mb-4 text-center text-gray-600">
          <p className="text-sm">{formatDateTime()}</p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="personnummer" className="block text-gray-700 mb-2">Personnummer</label>
          <div className="relative">
            <input
              type="text"
              id="personnummer"
              placeholder="ÅÅÅÅMMDD-XXXX, ÅÅÅÅMMDDXXXX eller YYMMDDXXXX"
              value={personnummer}
              onChange={handlePersonnummerChange}
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
              inputMode="numeric"
              pattern="[0-9-]*"
              autoFocus
            />
            <button 
              onClick={toggleNumpad}
              className="absolute right-2 top-2 bg-gray-200 p-1 rounded-full hover:bg-gray-300"
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
          
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
        
        {/* Numpad - alltid visas när showNumpad är true */}
        {showNumpad && <Numpad />}
        
        {!currentStatus ? (
          <button
            onClick={checkStatus}
            disabled={!personnummer || loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Kontrollerar...' : 'Fortsätt'}
          </button>
        ) : (
          <button
            onClick={handleCheckInOut}
            disabled={loading}
            className={`w-full text-white py-3 px-4 rounded-md transition duration-200 ${
              currentStatus === 'out' 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            {loading 
              ? 'Bearbetar...' 
              : currentStatus === 'out' 
                ? 'Stämpla in' 
                : 'Stämpla ut'
            }
          </button>
        )}
        
        {success && (
          <div className="mt-4 p-2 bg-green-100 text-green-700 rounded text-center">
            {success}
          </div>
        )}
      </div>
      
      {/* Right Column - Presence List */}
      <PresenceList />
    </div>
  );
};

// Export the component
window.EmployeeForm = EmployeeForm; 