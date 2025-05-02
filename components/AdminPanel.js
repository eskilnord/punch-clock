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
  const [chartData, setChartData] = React.useState(null);
  const [chartLoading, setChartLoading] = React.useState(false);
  
  // Referenser till graf-canvas
  const hourlyActivityChartRef = React.useRef(null);
  const employeeActivityChartRef = React.useRef(null);
  const workedHoursChartRef = React.useRef(null);
  const scheduledVsActualChartRef = React.useRef(null);
  
  // Spåra om grafer har skapats
  const chartsCreated = React.useRef({
    hourlyActivity: null,
    employeeActivity: null,
    workedHours: null,
    scheduledVsActual: null
  });
  
  // Sätt isMountedRef till false när komponenten avmonteras
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      
      // Rensa graf-objekt när komponenten avmonteras
      Object.values(chartsCreated.current).forEach(chart => {
        if (chart) chart.destroy();
      });
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
  
  // Ladda in statistikdata när statistikfliken aktiveras
  React.useEffect(() => {
    if (activeTab === 'statistics' && !chartData) {
      loadChartData();
    }
  }, [activeTab]);
  
  // Uppdatera grafer när chartData ändras
  React.useEffect(() => {
    if (chartData && activeTab === 'statistics') {
      renderCharts();
    }
  }, [chartData]);
  
  // Ladda statistikdata
  const loadChartData = async () => {
    setChartLoading(true);
    try {
      const data = await utils.prepareChartData(reportStartDate, reportEndDate);
      if (isMountedRef.current) {
        setChartData(data);
      }
    } catch (error) {
      console.error("Fel vid laddning av statistikdata:", error);
      if (isMountedRef.current) {
        setError("Kunde inte ladda statistikdata.");
      }
    } finally {
      if (isMountedRef.current) {
        setChartLoading(false);
      }
    }
  };
  
  // Rendera grafer
  const renderCharts = () => {
    if (!chartData) return;
    
    // Skapa färgpaletter
    const blueGradient = {
      backgroundColor: 'rgba(66, 135, 245, 0.6)',
      borderColor: 'rgba(66, 135, 245, 1)',
      borderWidth: 1
    };
    
    const greenGradient = {
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1
    };
    
    const orangeGradient = {
      backgroundColor: 'rgba(255, 159, 64, 0.6)',
      borderColor: 'rgba(255, 159, 64, 1)',
      borderWidth: 1
    };
    
    // 1. Aktivitet per timme
    if (hourlyActivityChartRef.current) {
      // Förstör befintlig graf om den finns
      if (chartsCreated.current.hourlyActivity) {
        chartsCreated.current.hourlyActivity.destroy();
      }
      
      const ctx = hourlyActivityChartRef.current.getContext('2d');
      chartsCreated.current.hourlyActivity = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.hourlyActivity.labels,
          datasets: [{
            label: 'Antal stämplingar',
            data: chartData.hourlyActivity.data,
            ...blueGradient
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Aktivitet under dygnet'
            },
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Timme'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Antal stämplingar'
              }
            }
          }
        }
      });
    }
    
    // 2. Aktiva medarbetare per dag
    if (employeeActivityChartRef.current && chartData.employeeActivity.labels.length > 0) {
      // Förstör befintlig graf om den finns
      if (chartsCreated.current.employeeActivity) {
        chartsCreated.current.employeeActivity.destroy();
      }
      
      const ctx = employeeActivityChartRef.current.getContext('2d');
      chartsCreated.current.employeeActivity = new Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.employeeActivity.labels,
          datasets: [{
            label: 'Aktiva medarbetare',
            data: chartData.employeeActivity.data,
            ...greenGradient,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Aktiva medarbetare per dag'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Datum'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Antal medarbetare'
              }
            }
          }
        }
      });
    }
    
    // 3. Arbetad tid per medarbetare
    if (workedHoursChartRef.current && chartData.workedHours.labels.length > 0) {
      // Förstör befintlig graf om den finns
      if (chartsCreated.current.workedHours) {
        chartsCreated.current.workedHours.destroy();
      }
      
      const ctx = workedHoursChartRef.current.getContext('2d');
      chartsCreated.current.workedHours = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.workedHours.labels,
          datasets: [{
            label: 'Arbetad tid (timmar)',
            data: chartData.workedHours.data,
            ...orangeGradient
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Total arbetad tid per person'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Timmar'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Medarbetare'
              }
            }
          }
        }
      });
    }
    
    // 4. Schemalagd vs faktisk tid
    if (scheduledVsActualChartRef.current && chartData.scheduledVsActual.labels.length > 0) {
      // Förstör befintlig graf om den finns
      if (chartsCreated.current.scheduledVsActual) {
        chartsCreated.current.scheduledVsActual.destroy();
      }
      
      const ctx = scheduledVsActualChartRef.current.getContext('2d');
      chartsCreated.current.scheduledVsActual = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartData.scheduledVsActual.labels,
          datasets: [
            {
              label: 'Schemalagd tid',
              data: chartData.scheduledVsActual.scheduled,
              backgroundColor: 'rgba(66, 135, 245, 0.6)',
              borderColor: 'rgba(66, 135, 245, 1)',
              borderWidth: 1
            },
            {
              label: 'Faktisk tid',
              data: chartData.scheduledVsActual.actual,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Schemalagd vs faktisk tid'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Datum'
              }
            },
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Timmar'
              }
            }
          }
        }
      });
    }
  };
  
  // Uppdatera statistikperiod och ladda ny data
  const handleUpdateStatisticsPeriod = () => {
    loadChartData();
  };
  
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
    <div className="max-w-6xl mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Administratörspanel</h1>
        <div className="flex items-center space-x-4">
          <p className="text-gray-600 hidden md:block">{formatDateTime()}</p>
          <button
            onClick={onLogout}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded"
          >
            Logga ut
          </button>
        </div>
      </div>
      
      {/* Tab navigation */}
      <div className="flex flex-wrap mb-6 bg-white shadow-sm rounded-lg overflow-hidden">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex-1 py-3 px-4 text-center transition ${
            activeTab === 'employees' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'
          }`}
        >
          <span className="block md:inline">Medarbetare </span>
          {pendingEmployees.length > 0 && (
            <span className="inline-block px-2 py-0.5 ml-2 text-xs rounded-full bg-red-500 text-white">
              {pendingEmployees.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex-1 py-3 px-4 text-center transition ${
            activeTab === 'reports' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Rapporter
        </button>
        <button
          onClick={() => setActiveTab('statistics')}
          className={`flex-1 py-3 px-4 text-center transition ${
            activeTab === 'statistics' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Statistik
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 px-4 text-center transition ${
            activeTab === 'settings' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Inställningar
        </button>
      </div>
      
      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
          <button 
            onClick={() => setError('')}
            className="float-right"
          >
            &times;
          </button>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-100 text-green-700 rounded-lg">
          {success}
          <button 
            onClick={() => setSuccess('')}
            className="float-right"
          >
            &times;
          </button>
        </div>
      )}
      
      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Add Employee Form */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Lägg till medarbetare</h2>
            <form onSubmit={handleAddEmployee}>
              <div className="mb-4">
                <label htmlFor="personnummer" className="block text-gray-700 mb-2">Personnummer</label>
                <div className="relative">
                  <input
                    type="text"
                    id="personnummer"
                    placeholder="ÅÅÅÅMMDD-XXXX"
                    value={newEmployee.personnummer}
                    onChange={(e) => setNewEmployee({...newEmployee, personnummer: e.target.value})}
                    className="w-full px-4 py-2 border rounded-md"
                    disabled={loading}
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
                
                {normalizedPersonnummer && normalizedPersonnummer !== newEmployee.personnummer && (
                  <p className="mt-1 text-sm text-gray-600">
                    Kommer att sparas som: {normalizedPersonnummer}
                  </p>
                )}
                
                {showNumpad && <Numpad />}
              </div>
              
              <div className="mb-4">
                <label htmlFor="name" className="block text-gray-700 mb-2">Namn</label>
                <input
                  type="text"
                  id="name"
                  placeholder="Medarbetarens namn"
                  value={newEmployee.name}
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-md"
                  disabled={loading}
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
                disabled={loading}
              >
                {loading ? 'Arbetar...' : 'Lägg till medarbetare'}
              </button>
            </form>
          </div>
          
          {/* Pending Employee List */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">
              Väntande medarbetare
              {pendingEmployees.length > 0 && (
                <span className="ml-2 text-sm font-medium py-1 px-2 bg-yellow-100 text-yellow-800 rounded-full">
                  {pendingEmployees.length} st
                </span>
              )}
            </h2>
            
            {pendingEmployees.length === 0 ? (
              <p className="text-gray-500">Inga väntande medarbetare.</p>
            ) : (
              <div className="overflow-y-auto max-h-[300px]">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personnummer</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingEmployees.map(employee => (
                      <tr key={employee.personnummer}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{employee.personnummer}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">{employee.name || '-'}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleApproveEmployee(employee.personnummer)}
                            className="mr-2 text-green-600 hover:text-green-900"
                            disabled={loading}
                          >
                            Godkänn
                          </button>
                          <button
                            onClick={() => handleRemoveEmployee(employee.personnummer)}
                            className="text-red-600 hover:text-red-900"
                            disabled={loading}
                          >
                            Ta bort
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Godkända medarbetare</h2>
              {employees.length === 0 ? (
                <p className="text-gray-500">Inga godkända medarbetare ännu.</p>
              ) : (
                <div className="overflow-y-auto max-h-[300px]">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personnummer</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namn</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {employees.map(employee => (
                        <tr key={employee.personnummer}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">{employee.personnummer}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">{employee.name || '-'}</td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleRemoveEmployee(employee.personnummer)}
                              className="text-red-600 hover:text-red-900"
                              disabled={loading}
                            >
                              Ta bort
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Rapporter</h2>
          
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-3">Närvarorapport</h3>
            <p className="mb-3 text-gray-600">
              Generera en rapport med alla stämplingar för alla medarbetare.
            </p>
            <button
              onClick={handleGenerateAttendanceReport}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
              disabled={loading}
            >
              {loading ? 'Genererar...' : 'Generera närvarorapport'}
            </button>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-3">Arbetstidssammanställning</h3>
            <p className="mb-3 text-gray-600">
              Generera en sammanställning av arbetade timmar per medarbetare över en period.
            </p>
            
            <form 
              onSubmit={handleGenerateWorkHoursSummary} 
              className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              <div>
                <label className="block text-gray-700 mb-1 text-sm">Startdatum</label>
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1 text-sm">Slutdatum</label>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md w-full"
                  disabled={loading}
                >
                  {loading ? 'Genererar...' : 'Generera rapport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Statistics Tab */}
      {activeTab === 'statistics' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Statistik och grafer</h2>
          
          <form className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 mb-1 text-sm">Startdatum</label>
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-gray-700 mb-1 text-sm">Slutdatum</label>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleUpdateStatisticsPeriod}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md w-full"
                disabled={chartLoading}
              >
                {chartLoading ? 'Laddar data...' : 'Uppdatera grafer'}
              </button>
            </div>
          </form>
          
          {chartLoading ? (
            <div className="flex justify-center items-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <canvas ref={hourlyActivityChartRef}></canvas>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <canvas ref={employeeActivityChartRef}></canvas>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <canvas ref={workedHoursChartRef}></canvas>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <canvas ref={scheduledVsActualChartRef}></canvas>
              </div>
            </div>
          )}
          
          <div className="mt-6 text-sm text-gray-500">
            <p>Statistiken visar:</p>
            <ul className="list-disc pl-5 mt-2">
              <li><strong>Aktivitet under dygnet:</strong> Antal stämplingar per timme under perioden.</li>
              <li><strong>Aktiva medarbetare per dag:</strong> Hur många unika medarbetare som stämplat in varje dag.</li>
              <li><strong>Total arbetad tid per person:</strong> Total arbetad tid för varje medarbetare under perioden.</li>
              <li><strong>Schemalagd vs faktisk tid:</strong> Jämförelse mellan planerad och faktiskt arbetad tid.</li>
            </ul>
          </div>
        </div>
      )}
      
      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Inställningar</h2>
          
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-3">Inställningar för arbetspass</h3>
            <div className="flex items-center">
              <span className="mr-3 text-gray-700">Kräv information om arbetspass</span>
              <div className="relative inline-block w-12 align-middle select-none">
                <input 
                  type="checkbox" 
                  id="require-shift-info" 
                  name="require-shift-info" 
                  checked={requireShiftInfo}
                  onChange={toggleShiftRequirement}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer right-0 checked:right-0"
                  disabled={loading}
                />
                <label 
                  htmlFor="require-shift-info" 
                  className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
                ></label>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              När denna inställning är aktiverad måste medarbetare ange information om sitt arbetspass när de stämplar in, som planerad start- och sluttid samt rast.
            </p>
          </div>
          
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-3 text-red-600">Rensa alla data</h3>
            <p className="mb-3 text-gray-600">
              Raderar all data som lagrats i applikationen, inklusive anställda, tidsstämplar och inställningar. Detta kan inte ångras.
            </p>
            
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md"
                disabled={loading}
              >
                Rensa alla data
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <span className="text-red-600 font-medium">Är du säker?</span>
                <button
                  onClick={handleClearData}
                  className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md"
                  disabled={loading}
                >
                  Ja, rensa all data
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-md"
                  disabled={loading}
                >
                  Avbryt
                </button>
              </div>
            )}
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