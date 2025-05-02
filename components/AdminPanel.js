// Admin Panel Component
const AdminPanel = ({ onLogout }) => {
  // Spåra om komponenten är monterad
  const isMountedRef = React.useRef(true);
  
  const [employees, setEmployees] = React.useState([]);
  const [pendingEmployees, setPendingEmployees] = React.useState([]);
  const [newEmployee, setNewEmployee] = React.useState({ personnummer: '', name: '' });
  const [normalizedPersonnummer, setNormalizedPersonnummer] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('employees');
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [reportStartDate, setReportStartDate] = React.useState(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  );
  const [reportEndDate, setReportEndDate] = React.useState(
    new Date().toISOString().split('T')[0]
  );
  const [currentDateTime, setCurrentDateTime] = React.useState(new Date());
  const [showNumpad, setShowNumpad] = React.useState(true);
  const [requireShiftInfo, setRequireShiftInfo] = React.useState(false);
  
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
      }
    }, 60000); // Update every 60 seconds
    
    return () => clearInterval(timer);
  }, []);
  
  // Load employees and settings on mount
  React.useEffect(() => {
    loadEmployees();
    loadSettings();
  }, []);
  
  // Load app settings
  const loadSettings = async () => {
    try {
      console.log("Loading settings...");
      const requireShift = await dbService.getConfig('requireShiftInfo');
      console.log("Loaded requireShiftInfo:", requireShift);
      
      if (isMountedRef.current) {
        setRequireShiftInfo(requireShift === 'true');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };
  
  // Save the shift requirement setting
  const toggleShiftRequirement = async () => {
    setLoading(true);
    try {
      const newValue = !requireShiftInfo;
      console.log("Saving requireShiftInfo:", newValue.toString());
      await dbService.saveConfig('requireShiftInfo', newValue.toString());
      
      if (isMountedRef.current) {
        setRequireShiftInfo(newValue);
        setSuccess(`Arbetspass-inmatning ${newValue ? 'aktiverad' : 'inaktiverad'}`);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess('');
          }
        }, 3000);
      }
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid sparande av inställningar.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Try to normalize personnummer when it changes
  React.useEffect(() => {
    try {
      if (newEmployee.personnummer.length >= 10) {
        const normalized = utils.normalizePersonnummer(newEmployee.personnummer);
        setNormalizedPersonnummer(normalized);
      } else {
        setNormalizedPersonnummer('');
      }
    } catch (err) {
      console.error('Error normalizing personnummer:', err);
      setNormalizedPersonnummer('');
    }
  }, [newEmployee.personnummer]);
  
  // Numpad functions
  const addDigit = (digit) => {
    setNewEmployee({
      ...newEmployee, 
      personnummer: newEmployee.personnummer + digit
    });
  };
  
  const addHyphen = () => {
    if (!newEmployee.personnummer.includes('-')) {
      setNewEmployee({
        ...newEmployee, 
        personnummer: newEmployee.personnummer + '-'
      });
    }
  };
  
  const deleteLastChar = () => {
    setNewEmployee({
      ...newEmployee, 
      personnummer: newEmployee.personnummer.slice(0, -1)
    });
  };
  
  const clearPersonnummer = () => {
    setNewEmployee({
      ...newEmployee, 
      personnummer: ''
    });
  };
  
  const toggleNumpad = () => {
    setShowNumpad(prev => !prev);
  };
  
  // Load all employees from database
  const loadEmployees = async () => {
    if (!isMountedRef.current) return;
    
    setLoading(true);
    try {
      const allEmployees = await dbService.getAllEmployees();
      
      if (!isMountedRef.current) return;
      
      // Separera godkända och ej godkända medarbetare
      const approved = allEmployees.filter(emp => emp.approved !== false);
      const pending = allEmployees.filter(emp => emp.approved === false);
      
      setEmployees(approved);
      setPendingEmployees(pending);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Kunde inte ladda medarbetare.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Handle adding a new employee
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    
    if (!utils.validatePersonnummer(newEmployee.personnummer)) {
      setError('Ogiltigt personnummer format. Försök med format som: ÅÅÅÅMMDD-XXXX, ÅÅÅÅMMDDXXXX eller YYMMDDXXXX.');
      return;
    }
    
    // Normalize the personnummer
    const normalizedPnr = utils.normalizePersonnummer(newEmployee.personnummer);
    
    setLoading(true);
    
    try {
      // Check if employee already exists
      const existing = await dbService.getEmployee(normalizedPnr);
      
      if (!isMountedRef.current) return;
      
      if (existing) {
        setError('En medarbetare med detta personnummer finns redan.');
        setLoading(false);
        return;
      }
      
      // Add new employee with normalized personnummer
      await dbService.saveEmployee({
        personnummer: normalizedPnr,
        name: newEmployee.name || '',
        approved: true // godkänn direkt när admin lägger till
      });
      
      if (!isMountedRef.current) return;
      
      // Reset form and reload employees
      setNewEmployee({ personnummer: '', name: '' });
      setNormalizedPersonnummer('');
      await loadEmployees();
      
      if (!isMountedRef.current) return;
      
      setSuccess('Medarbetare tillagd!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setSuccess('');
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid tillägg av medarbetare.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Numpad component
  const Numpad = () => (
    <div className="mt-2 bg-gray-100 p-3 rounded-lg">
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(number => (
          <button
            key={number}
            onClick={() => addDigit(number.toString())}
            className="bg-white py-2 px-3 rounded shadow hover:bg-gray-50 text-lg font-medium"
            type="button"
          >
            {number}
          </button>
        ))}
        <button
          onClick={addHyphen}
          className="bg-white py-2 px-3 rounded shadow hover:bg-gray-50 text-lg font-medium"
          type="button"
        >
          -
        </button>
        <button
          onClick={() => addDigit('0')}
          className="bg-white py-2 px-3 rounded shadow hover:bg-gray-50 text-lg font-medium"
          type="button"
        >
          0
        </button>
        <button
          onClick={deleteLastChar}
          className="bg-white py-2 px-3 rounded shadow hover:bg-gray-50 text-lg font-medium"
          type="button"
        >
          ⌫
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1">
        <button
          onClick={clearPersonnummer}
          className="bg-red-100 py-2 rounded shadow hover:bg-red-200 text-red-700"
          type="button"
        >
          Rensa
        </button>
      </div>
    </div>
  );
  
  // Handle removing an employee
  const handleRemoveEmployee = async (personnummer) => {
    if (window.confirm(`Är du säker på att du vill ta bort medarbetare med personnummer ${personnummer}?`)) {
      setLoading(true);
      
      try {
        await dbService.deleteEmployee(personnummer);
        
        if (!isMountedRef.current) return;
        
        await loadEmployees();
        
        if (!isMountedRef.current) return;
        
        setSuccess('Medarbetare borttagen!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess('');
          }
        }, 3000);
      } catch (err) {
        console.error(err);
        if (isMountedRef.current) {
          setError('Ett fel uppstod vid borttagning av medarbetare.');
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }
  };
  
  // Handle approving a pending employee
  const handleApproveEmployee = async (personnummer) => {
    setLoading(true);
    
    try {
      // Hämta medarbetaren först
      const employee = await dbService.getEmployee(personnummer);
      
      if (!isMountedRef.current) return;
      
      // Uppdatera med approved=true
      await dbService.saveEmployee({
        ...employee,
        approved: true
      });
      
      if (!isMountedRef.current) return;
      
      await loadEmployees();
      
      if (!isMountedRef.current) return;
      
      setSuccess('Medarbetare godkänd!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setSuccess('');
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid godkännande av medarbetare.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Generate and download attendance report
  const handleGenerateAttendanceReport = async () => {
    setLoading(true);
    
    try {
      const filename = await utils.generateAttendanceReport();
      
      if (!isMountedRef.current) return;
      
      setSuccess(`Rapporten har genererats och laddats ner: ${filename}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setSuccess('');
        }
      }, 5000);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid generering av rapport.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Generate and download work hours summary
  const handleGenerateWorkHoursSummary = async (e) => {
    e.preventDefault();
    
    if (!reportStartDate || !reportEndDate) {
      setError('Ange både start- och slutdatum.');
      return;
    }
    
    if (new Date(reportStartDate) > new Date(reportEndDate)) {
      setError('Startdatum måste vara före slutdatum.');
      return;
    }
    
    setLoading(true);
    
    try {
      const filename = await utils.generateWorkHoursSummary(reportStartDate, reportEndDate);
      
      if (!isMountedRef.current) return;
      
      setSuccess(`Rapporten har genererats och laddats ner: ${filename}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        if (isMountedRef.current) {
          setSuccess('');
        }
      }, 5000);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid generering av rapport.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Clear all data with confirmation
  const handleClearData = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    
    setLoading(true);
    
    try {
      await dbService.clearAllData();
      
      if (!isMountedRef.current) return;
      
      setSuccess('All data har rensats. Du kommer att loggas ut...');
      
      // Logout after 2 seconds
      setTimeout(onLogout, 2000);
    } catch (err) {
      console.error(err);
      if (isMountedRef.current) {
        setError('Ett fel uppstod vid rensning av data.');
        setConfirmClear(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
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
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-gray-800">Administratörspanel</h2>
        <button
          onClick={onLogout}
          className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md"
        >
          Logga ut
        </button>
      </div>
      
      {/* Current Date and Time */}
      <div className="mb-4 text-center text-gray-600">
        <p className="text-sm">{formatDateTime()}</p>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('employees')}
          className={`py-2 px-4 ${activeTab === 'employees' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-500'}`}
        >
          Medarbetare
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-4 ${activeTab === 'pending' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-500'} ${pendingEmployees.length > 0 ? 'relative' : ''}`}
        >
          Väntande
          {pendingEmployees.length > 0 && (
            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
              {pendingEmployees.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`py-2 px-4 ${activeTab === 'reports' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-500'}`}
        >
          Rapporter
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`py-2 px-4 ${activeTab === 'settings' 
            ? 'border-b-2 border-blue-500 text-blue-500' 
            : 'text-gray-500'}`}
        >
          Inställningar
        </button>
      </div>
      
      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
          {success}
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Hantera medarbetare</h3>
          
          {/* Add Employee Form */}
          <form onSubmit={handleAddEmployee} className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="personnummer" className="block text-gray-700 mb-1">Personnummer</label>
                <div className="relative">
                  <input
                    type="text"
                    id="personnummer"
                    placeholder="ÅÅÅÅMMDD-XXXX"
                    value={newEmployee.personnummer}
                    onChange={(e) => setNewEmployee({...newEmployee, personnummer: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md"
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                    )}
                  </button>
                </div>
                
                {normalizedPersonnummer && normalizedPersonnummer !== newEmployee.personnummer && (
                  <p className="mt-1 text-sm text-gray-600">
                    Kommer att sparas som: {normalizedPersonnummer}
                  </p>
                )}
                
                {/* Numpad - visas alltid som standard */}
                {showNumpad && <Numpad />}
              </div>
              
              <div>
                <label htmlFor="name" className="block text-gray-700 mb-1">Namn (valfritt)</label>
                <input
                  type="text"
                  id="name"
                  placeholder="Namn"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={loading}
                />
              </div>
              
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={loading || !newEmployee.personnummer}
                  className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md disabled:opacity-50"
                >
                  Lägg till
                </button>
              </div>
            </div>
          </form>
          
          {/* Employees List */}
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b text-left">Personnummer</th>
                  <th className="py-2 px-4 border-b text-left">Namn</th>
                  <th className="py-2 px-4 border-b text-left">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-4 px-4 text-center text-gray-500">
                      Inga medarbetare tillagda
                    </td>
                  </tr>
                ) : (
                  employees.map(employee => (
                    <tr key={employee.personnummer}>
                      <td className="py-2 px-4 border-b">{employee.personnummer}</td>
                      <td className="py-2 px-4 border-b">{employee.name || '-'}</td>
                      <td className="py-2 px-4 border-b">
                        <button
                          onClick={() => handleRemoveEmployee(employee.personnummer)}
                          disabled={loading}
                          className="text-red-500 hover:text-red-700"
                        >
                          Ta bort
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Pending Employees Tab */}
      {activeTab === 'pending' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Väntande godkännanden</h3>
          
          {pendingEmployees.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              Inga väntande godkännanden
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border">
                <thead>
                  <tr>
                    <th className="py-2 px-4 border-b text-left">Personnummer</th>
                    <th className="py-2 px-4 border-b text-left">Namn</th>
                    <th className="py-2 px-4 border-b text-left">Åtgärder</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEmployees.map(employee => (
                    <tr key={employee.personnummer} className="bg-yellow-50">
                      <td className="py-2 px-4 border-b">{employee.personnummer}</td>
                      <td className="py-2 px-4 border-b">{employee.name || '-'}</td>
                      <td className="py-2 px-4 border-b">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproveEmployee(employee.personnummer)}
                            disabled={loading}
                            className="text-green-500 hover:text-green-700 mr-4"
                          >
                            Godkänn
                          </button>
                          <button
                            onClick={() => handleRemoveEmployee(employee.personnummer)}
                            disabled={loading}
                            className="text-red-500 hover:text-red-700"
                          >
                            Ta bort
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Rapporter</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attendance Report */}
            <div className="border p-4 rounded-md">
              <h4 className="font-medium mb-2">Närvarorapport</h4>
              <p className="text-sm text-gray-600 mb-4">
                Generera en rapport över alla stämplingstider.
              </p>
              <button
                onClick={handleGenerateAttendanceReport}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md w-full disabled:opacity-50"
              >
                {loading ? 'Genererar...' : 'Generera närvarorapport'}
              </button>
            </div>
            
            {/* Work Hours Summary */}
            <div className="border p-4 rounded-md">
              <h4 className="font-medium mb-2">Arbetstidssammanställning</h4>
              <p className="text-sm text-gray-600 mb-4">
                Generera en sammanställning av arbetade timmar för en period.
              </p>
              
              <form onSubmit={handleGenerateWorkHoursSummary}>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div>
                    <label htmlFor="startDate" className="block text-sm text-gray-600 mb-1">Startdatum</label>
                    <input
                      type="date"
                      id="startDate"
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={loading}
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="endDate" className="block text-sm text-gray-600 mb-1">Slutdatum</label>
                    <input
                      type="date"
                      id="endDate"
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !reportStartDate || !reportEndDate}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md w-full disabled:opacity-50"
                >
                  {loading ? 'Genererar...' : 'Generera sammanställning'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Inställningar</h3>
          
          {/* Shift Info Setting */}
          <div className="border p-4 rounded-md mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">Arbetspass-information</h4>
                <p className="text-sm text-gray-600 mt-1">
                  {requireShiftInfo
                    ? "Medarbetare måste ange arbetspass vid instämpling"
                    : "Medarbetare behöver inte ange arbetspass"}
                </p>
              </div>
              <div className="relative inline-block w-12 align-middle select-none transition duration-200 ease-in">
                <input
                  type="checkbox"
                  name="toggle"
                  id="toggle-shift-info"
                  checked={requireShiftInfo}
                  onChange={toggleShiftRequirement}
                  disabled={loading}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label
                  htmlFor="toggle-shift-info"
                  className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${
                    requireShiftInfo ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                ></label>
              </div>
            </div>
          </div>
          
          {/* Clear Data Setting */}
          <div className="border p-4 rounded-md bg-red-50">
            <h4 className="font-medium mb-2">Rensa all data</h4>
            <p className="text-sm text-gray-600 mb-4">
              Detta kommer att radera all data, inklusive medarbetare, stämplingar och inställningar.
              Denna åtgärd kan inte ångras.
            </p>
            
            <button
              onClick={handleClearData}
              disabled={loading}
              className={`text-white py-2 px-4 rounded-md w-full ${
                confirmClear 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50`}
            >
              {loading 
                ? 'Bearbetar...' 
                : confirmClear 
                  ? 'Bekräfta rensning av all data' 
                  : 'Rensa all data'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Export the component
window.AdminPanel = AdminPanel;

// CSS for the toggle
document.head.insertAdjacentHTML(
  'beforeend',
  `<style>
    .toggle-checkbox:checked {
      right: 0;
      border-color: #fff;
    }
    .toggle-checkbox:checked + .toggle-label {
      background-color: #4F46E5;
    }
    .toggle-label {
      transition: background-color 0.2s ease;
    }
  </style>`
); 