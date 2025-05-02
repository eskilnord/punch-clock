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
  
  // Data för tidredgeringsfliken
  const [selectedMonth, setSelectedMonth] = React.useState(
    new Date().toISOString().substring(0, 7) // YYYY-MM format
  );
  const [selectedEmployee, setSelectedEmployee] = React.useState(null);
  const [timestamps, setTimestamps] = React.useState([]);
  const [timestampsLoading, setTimestampsLoading] = React.useState(false);
  const [editingTimestamp, setEditingTimestamp] = React.useState(null);
  const [approvedMonths, setApprovedMonths] = React.useState({});
  
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
  
  // Skapa ny tidsstämpling manuellt
  const [newTimestamp, setNewTimestamp] = React.useState({
    checkInTime: new Date().toISOString(),
    checkOutTime: null,
    shiftInfo: { 
      breakDuration: 0,
      scheduledStart: null,
      scheduledEnd: null
    }
  });
  const [showNewTimestampForm, setShowNewTimestampForm] = React.useState(false);
  
  // Ladda alla medarbetares tidsstämplingar för vald månad
  const [allEmployeesTimestamps, setAllEmployeesTimestamps] = React.useState({});
  const [allEmployeesTimestampsLoading, setAllEmployeesTimestampsLoading] = React.useState(false);
  
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
    loadApprovedMonths();
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
  
  // Ladda tidsstämplingar när medarbetare eller månad väljs
  React.useEffect(() => {
    if (activeTab === 'timeEdit') {
      if (selectedEmployee) {
        loadEmployeeTimestamps();
      } else {
        loadAllEmployeesTimestamps();
      }
    }
  }, [activeTab, selectedEmployee, selectedMonth]);
  
  // Ladda in godkända månader
  const loadApprovedMonths = async () => {
    try {
      const approvedData = await dbService.getConfig('approvedMonths');
      if (approvedData) {
        const parsed = typeof approvedData === 'string' ? JSON.parse(approvedData) : approvedData;
        setApprovedMonths(parsed || {});
      }
    } catch (err) {
      console.error('Error loading approved months:', err);
    }
  };
  
  // Spara godkända månader
  const saveApprovedMonths = async (updatedApprovedMonths) => {
    try {
      await dbService.saveConfig('approvedMonths', JSON.stringify(updatedApprovedMonths));
      setApprovedMonths(updatedApprovedMonths);
    } catch (err) {
      console.error('Error saving approved months:', err);
      throw err;
    }
  };
  
  // Ladda en medarbetares tidsstämplingar för vald månad
  const loadEmployeeTimestamps = async () => {
    if (!selectedEmployee) return;
    
    setTimestampsLoading(true);
    
    try {
      // Hämta alla tidsstämplingar
      const allTimestamps = await dbService.getAllTimestamps();
      
      // Filtrera efter medarbetare och månad
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(year, month - 1, 1); // Månadens första dag
      const endDate = new Date(year, month, 0); // Månadens sista dag
      endDate.setHours(23, 59, 59, 999); // Sätt till slutet av dagen
      
      const filteredTimestamps = allTimestamps.filter(ts => {
        const tsDate = new Date(ts.checkInTime);
        return ts.personnummer === selectedEmployee &&
               tsDate >= startDate &&
               tsDate <= endDate;
      });
      
      // Sortera efter datum (äldst först)
      filteredTimestamps.sort((a, b) => new Date(a.checkInTime) - new Date(b.checkInTime));
      
      if (isMountedRef.current) {
        setTimestamps(filteredTimestamps);
      }
    } catch (err) {
      console.error('Error loading employee timestamps:', err);
      if (isMountedRef.current) {
        setError('Kunde inte ladda tidsstämplingar.');
      }
    } finally {
      if (isMountedRef.current) {
        setTimestampsLoading(false);
      }
    }
  };
  
  // Ladda alla medarbetares tidsstämplingar för vald månad
  const loadAllEmployeesTimestamps = async () => {
    setAllEmployeesTimestampsLoading(true);
    
    try {
      // Hämta alla tidsstämplingar
      const allTimestamps = await dbService.getAllTimestamps();
      
      // Filtrera efter månad
      const [year, month] = selectedMonth.split('-');
      const startDate = new Date(year, month - 1, 1); // Månadens första dag
      const endDate = new Date(year, month, 0); // Månadens sista dag
      endDate.setHours(23, 59, 59, 999); // Sätt till slutet av dagen
      
      // Gruppera tidsstämplingar efter medarbetare
      const timestampsByEmployee = {};
      
      allTimestamps.forEach(ts => {
        const tsDate = new Date(ts.checkInTime);
        
        // Kontrollera om tidsstämplingen är inom vald månad
        if (tsDate >= startDate && tsDate <= endDate) {
          if (!timestampsByEmployee[ts.personnummer]) {
            timestampsByEmployee[ts.personnummer] = [];
          }
          
          timestampsByEmployee[ts.personnummer].push(ts);
        }
      });
      
      if (isMountedRef.current) {
        setAllEmployeesTimestamps(timestampsByEmployee);
      }
    } catch (err) {
      console.error('Error loading all employees timestamps:', err);
      if (isMountedRef.current) {
        setError('Kunde inte ladda tidsstämplingar för alla medarbetare.');
      }
    } finally {
      if (isMountedRef.current) {
        setAllEmployeesTimestampsLoading(false);
      }
    }
  };
  
  // Beräkna arbetstid för en medarbetare
  const calculateEmployeeWorkHours = (timestamps) => {
    if (!timestamps || timestamps.length === 0) {
      return {
        totalHours: 0,
        completedShifts: 0,
        openShifts: 0
      };
    }
    
    let totalHours = 0;
    let completedShifts = 0;
    let openShifts = 0;
    
    timestamps.forEach(ts => {
      if (ts.checkOutTime) {
        totalHours += utils.timestampToHours(
          ts.checkInTime, 
          ts.checkOutTime, 
          ts.shiftInfo?.breakDuration || 0
        );
        completedShifts++;
      } else {
        openShifts++;
      }
    });
    
    return {
      totalHours,
      completedShifts,
      openShifts
    };
  };
  
  // Få namn på medarbetare från personnummer
  const getEmployeeName = (personnummer) => {
    const employee = employees.find(emp => emp.personnummer === personnummer);
    return employee ? employee.name || personnummer : personnummer;
  };
  
  // Kontrollera om en månad är godkänd för en medarbetare
  const isMonthApprovedForEmployee = (personnummer) => {
    if (!personnummer || !selectedMonth || !approvedMonths[personnummer]) {
      return false;
    }
    
    return approvedMonths[personnummer].includes(selectedMonth);
  };
  
  // Starta redigering av en tidsstämpling
  const handleEditTimestamp = (timestamp) => {
    setEditingTimestamp({...timestamp});
  };
  
  // Avbryt redigering
  const handleCancelEdit = () => {
    setEditingTimestamp(null);
  };
  
  // Spara redigerad tidsstämpling
  const handleSaveTimestamp = async () => {
    if (!editingTimestamp) return;
    
    setLoading(true);
    
    try {
      // Spara den redigerade tidsstämplingen
      await dbService.saveTimestamp(editingTimestamp);
      
      if (isMountedRef.current) {
        // Uppdatera listan med stämplingar
        loadEmployeeTimestamps();
        setEditingTimestamp(null);
        setSuccess('Tidsstämplingen har uppdaterats.');
        
        // Rensa meddelande efter några sekunder
        setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess('');
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Error saving timestamp:', err);
      if (isMountedRef.current) {
        setError('Kunde inte spara ändringar.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Radera en tidsstämpling
  const handleDeleteTimestamp = async (id) => {
    if (!window.confirm('Är du säker på att du vill radera denna tidsstämpling?')) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Radera tidsstämplingen
      await dbService.deleteTimestamp(id);
      
      if (isMountedRef.current) {
        // Uppdatera listan med stämplingar
        loadEmployeeTimestamps();
        setSuccess('Tidsstämplingen har raderats.');
        
        // Rensa meddelande efter några sekunder
        setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess('');
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Error deleting timestamp:', err);
      if (isMountedRef.current) {
        setError('Kunde inte radera tidsstämplingen.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Godkänn en medarbetares månadsrapport
  const handleApproveMonth = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    setLoading(true);
    
    try {
      // Uppdatera godkända månader
      const updatedApprovedMonths = {...approvedMonths};
      
      if (!updatedApprovedMonths[selectedEmployee]) {
        updatedApprovedMonths[selectedEmployee] = [];
      }
      
      // Kontrollera om månaden redan är godkänd
      if (!updatedApprovedMonths[selectedEmployee].includes(selectedMonth)) {
        updatedApprovedMonths[selectedEmployee].push(selectedMonth);
        
        // Sortera månader i kronologisk ordning
        updatedApprovedMonths[selectedEmployee].sort();
        
        // Spara uppdaterade godkända månader
        await saveApprovedMonths(updatedApprovedMonths);
        
        if (isMountedRef.current) {
          setSuccess(`Månad ${selectedMonth} godkänd för vald medarbetare.`);
          
          // Rensa meddelande efter några sekunder
          setTimeout(() => {
            if (isMountedRef.current) {
              setSuccess('');
            }
          }, 3000);
        }
      } else {
        if (isMountedRef.current) {
          setError('Denna månad är redan godkänd.');
          
          // Rensa felmeddelande efter några sekunder
          setTimeout(() => {
            if (isMountedRef.current) {
              setError('');
            }
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Error approving month:', err);
      if (isMountedRef.current) {
        setError('Kunde inte godkänna månaden.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
  // Ta bort godkännande för en månad
  const handleUnapproveMonth = async () => {
    if (!selectedEmployee || !selectedMonth) return;
    
    setLoading(true);
    
    try {
      // Uppdatera godkända månader
      const updatedApprovedMonths = {...approvedMonths};
      
      if (updatedApprovedMonths[selectedEmployee] && 
          updatedApprovedMonths[selectedEmployee].includes(selectedMonth)) {
        
        // Ta bort månaden från godkända månader
        updatedApprovedMonths[selectedEmployee] = updatedApprovedMonths[selectedEmployee]
          .filter(month => month !== selectedMonth);
        
        // Spara uppdaterade godkända månader
        await saveApprovedMonths(updatedApprovedMonths);
        
        if (isMountedRef.current) {
          setSuccess(`Godkännande för månad ${selectedMonth} borttaget.`);
          
          // Rensa meddelande efter några sekunder
          setTimeout(() => {
            if (isMountedRef.current) {
              setSuccess('');
            }
          }, 3000);
        }
      } else {
        if (isMountedRef.current) {
          setError('Denna månad är inte godkänd.');
          
          // Rensa felmeddelande efter några sekunder
          setTimeout(() => {
            if (isMountedRef.current) {
              setError('');
            }
          }, 3000);
        }
      }
    } catch (err) {
      console.error('Error unapproving month:', err);
      if (isMountedRef.current) {
        setError('Kunde inte ta bort godkännande för månaden.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };
  
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
  
  // Kontrollera om vald månad är godkänd
  const isMonthApproved = () => {
    if (!selectedEmployee || !selectedMonth || !approvedMonths[selectedEmployee]) {
      return false;
    }
    
    return approvedMonths[selectedEmployee].includes(selectedMonth);
  };
  
  // Hantera visning av formulär för ny tidsstämpling
  const handleShowNewTimestampForm = () => {
    // Skapa ett utgångsdatum från dagens datum men med valda månadens år och månad
    const [year, month] = selectedMonth.split('-');
    const today = new Date();
    const defaultDate = new Date(year, month - 1, Math.min(today.getDate(), new Date(year, month, 0).getDate()));
    
    // Sätt standardtid till 08:00 för incheckning och 16:30 för utcheckning
    const inTime = new Date(defaultDate);
    inTime.setHours(8, 0, 0, 0);
    
    const outTime = new Date(defaultDate);
    outTime.setHours(16, 30, 0, 0);
    
    // Sätt standardtid för schemalagd arbetstid
    const scheduledInTime = new Date(defaultDate);
    scheduledInTime.setHours(8, 0, 0, 0);
    
    const scheduledOutTime = new Date(defaultDate);
    scheduledOutTime.setHours(16, 0, 0, 0);
    
    setNewTimestamp({
      personnummer: selectedEmployee,
      checkInTime: inTime.toISOString(),
      checkOutTime: outTime.toISOString(),
      shiftInfo: { 
        breakDuration: 30,
        scheduledStart: scheduledInTime.toISOString(),
        scheduledEnd: scheduledOutTime.toISOString()
      }
    });
    
    setShowNewTimestampForm(true);
  };
  
  // Spara ny tidsstämpling
  const handleSaveNewTimestamp = async () => {
    if (!newTimestamp.checkInTime) {
      setError('Incheckningstid måste anges.');
      return;
    }
    
    setLoading(true);
    
    try {
      // Spara den nya tidsstämplingen
      await dbService.saveTimestamp(newTimestamp);
      
      if (isMountedRef.current) {
        // Uppdatera listan med stämplingar
        loadEmployeeTimestamps();
        setShowNewTimestampForm(false);
        setSuccess('Ny tidsstämpling har skapats.');
        
        // Rensa meddelande efter några sekunder
        setTimeout(() => {
          if (isMountedRef.current) {
            setSuccess('');
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Error saving new timestamp:', err);
      if (isMountedRef.current) {
        setError('Kunde inte spara ny tidsstämpling.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
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
          onClick={() => setActiveTab('timeEdit')}
          className={`flex-1 py-3 px-4 text-center transition ${
            activeTab === 'timeEdit' ? 'bg-blue-500 text-white' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Tidredaktör
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
      
      {/* Time Edit Tab */}
      {activeTab === 'timeEdit' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Tidredaktör</h2>
          <p className="mb-6 text-gray-600">
            Här kan du se och redigera medarbetares tidsstämplingar samt godkänna månadsrapporter.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {/* Dropdown för att välja medarbetare */}
            <div>
              <label className="block text-gray-700 mb-2 text-sm font-medium">Medarbetare</label>
              <select
                value={selectedEmployee || ''}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                disabled={loading}
              >
                <option value="">Visa alla medarbetare</option>
                {employees.map(emp => (
                  <option key={emp.personnummer} value={emp.personnummer}>
                    {emp.name || emp.personnummer}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Väljare för månad */}
            <div>
              <label className="block text-gray-700 mb-2 text-sm font-medium">Månad</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                disabled={loading}
              />
            </div>
            
            {/* Status och knappar */}
            <div className="flex flex-col justify-end">
              {selectedEmployee && selectedMonth && (
                <>
                  <div className="mb-2">
                    <span className="text-sm font-medium mr-2">Status:</span>
                    {isMonthApproved() ? (
                      <span className="bg-green-100 text-green-800 text-xs font-medium py-1 px-2 rounded">
                        Godkänd
                      </span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 text-xs font-medium py-1 px-2 rounded">
                        Ej godkänd
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {isMonthApproved() ? (
                      <button
                        onClick={handleUnapproveMonth}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-md text-sm"
                        disabled={loading || timestampsLoading}
                      >
                        Ta bort godkännande
                      </button>
                    ) : (
                      <button
                        onClick={handleApproveMonth}
                        className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md text-sm"
                        disabled={loading || timestampsLoading}
                      >
                        Godkänn månad
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Översikt över alla medarbetare */}
          {!selectedEmployee && (
            <>
              <h3 className="text-lg font-medium mb-3">Sammanställning för alla medarbetare</h3>
              
              {allEmployeesTimestampsLoading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : Object.keys(allEmployeesTimestamps).length === 0 ? (
                <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                  Inga tidsstämplingar hittades för denna period.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Medarbetare
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Antal pass
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total arbetstid
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Åtgärder
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(allEmployeesTimestamps).map(([personnummer, timestamps]) => {
                          const workHours = calculateEmployeeWorkHours(timestamps);
                          const isApproved = isMonthApprovedForEmployee(personnummer);
                          
                          return (
                            <tr key={personnummer} className={isApproved ? 'bg-green-50' : ''}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                {getEmployeeName(personnummer)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {workHours.completedShifts + workHours.openShifts}
                                {workHours.openShifts > 0 && (
                                  <span className="text-yellow-600 ml-1">
                                    ({workHours.openShifts} öppna)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {workHours.totalHours.toFixed(2)} timmar
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {isApproved ? (
                                  <span className="bg-green-100 text-green-800 text-xs font-medium py-1 px-2 rounded">
                                    Godkänd
                                  </span>
                                ) : (
                                  <span className="bg-yellow-100 text-yellow-800 text-xs font-medium py-1 px-2 rounded">
                                    Ej godkänd
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <button
                                  onClick={() => setSelectedEmployee(personnummer)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  Visa detaljer
                                </button>
                                
                                {!isApproved && (
                                  <button
                                    onClick={async () => {
                                      setLoading(true);
                                      try {
                                        const updatedApprovedMonths = {...approvedMonths};
                                        
                                        if (!updatedApprovedMonths[personnummer]) {
                                          updatedApprovedMonths[personnummer] = [];
                                        }
                                        
                                        updatedApprovedMonths[personnummer].push(selectedMonth);
                                        updatedApprovedMonths[personnummer].sort();
                                        
                                        await saveApprovedMonths(updatedApprovedMonths);
                                        
                                        if (isMountedRef.current) {
                                          setSuccess(`Månad ${selectedMonth} godkänd för ${getEmployeeName(personnummer)}.`);
                                          loadAllEmployeesTimestamps();
                                          
                                          setTimeout(() => {
                                            if (isMountedRef.current) {
                                              setSuccess('');
                                            }
                                          }, 3000);
                                        }
                                      } catch (err) {
                                        console.error('Error approving month:', err);
                                        if (isMountedRef.current) {
                                          setError('Kunde inte godkänna månaden.');
                                        }
                                      } finally {
                                        if (isMountedRef.current) {
                                          setLoading(false);
                                        }
                                      }
                                    }}
                                    className="text-green-600 hover:text-green-900 ml-3"
                                    disabled={loading}
                                  >
                                    Godkänn
                                  </button>
                                )}
                                
                                {isApproved && (
                                  <button
                                    onClick={async () => {
                                      setLoading(true);
                                      try {
                                        const updatedApprovedMonths = {...approvedMonths};
                                        
                                        if (updatedApprovedMonths[personnummer]) {
                                          updatedApprovedMonths[personnummer] = updatedApprovedMonths[personnummer]
                                            .filter(month => month !== selectedMonth);
                                          
                                          await saveApprovedMonths(updatedApprovedMonths);
                                          
                                          if (isMountedRef.current) {
                                            setSuccess(`Godkännande borttaget för ${getEmployeeName(personnummer)}.`);
                                            loadAllEmployeesTimestamps();
                                            
                                            setTimeout(() => {
                                              if (isMountedRef.current) {
                                                setSuccess('');
                                              }
                                            }, 3000);
                                          }
                                        }
                                      } catch (err) {
                                        console.error('Error unapproving month:', err);
                                        if (isMountedRef.current) {
                                          setError('Kunde inte ta bort godkännande.');
                                        }
                                      } finally {
                                        if (isMountedRef.current) {
                                          setLoading(false);
                                        }
                                      }
                                    }}
                                    className="text-yellow-600 hover:text-yellow-900 ml-3"
                                    disabled={loading}
                                  >
                                    Ta bort godkännande
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Sammanställning av alla medarbetare */}
                  <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Total sammanställning för {selectedMonth}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm text-gray-500">Totalt antal medarbetare:</span>
                        <p className="font-medium">{Object.keys(allEmployeesTimestamps).length}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Totalt antal arbetspass:</span>
                        <p className="font-medium">
                          {Object.values(allEmployeesTimestamps).reduce((sum, timestamps) => sum + timestamps.length, 0)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Total arbetstid:</span>
                        <p className="font-medium">
                          {Object.values(allEmployeesTimestamps).reduce((sum, timestamps) => {
                            const workHours = calculateEmployeeWorkHours(timestamps);
                            return sum + workHours.totalHours;
                          }, 0).toFixed(2)} timmar
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          
          {/* Tidsstämplingar för vald medarbetare */}
          {selectedEmployee && (
            <>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium">Tidsstämplingar</h3>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setSelectedEmployee(null)}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded-md text-sm"
                  >
                    &larr; Tillbaka till översikten
                  </button>
                  
                  {!isMonthApproved() && (
                    <button
                      onClick={handleShowNewTimestampForm}
                      className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded-md text-sm"
                      disabled={loading || timestampsLoading}
                    >
                      + Lägg till manuell stämpling
                    </button>
                  )}
                </div>
              </div>
              
              {/* Formulär för att lägga till ny tidsstämpling */}
              {showNewTimestampForm && (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Lägg till ny tidsstämpling</h4>
                    <button
                      onClick={() => setShowNewTimestampForm(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      &times;
                    </button>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-sm mb-2 text-gray-700">Faktisk arbetstid</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Datum</label>
                        <input
                          type="date"
                          value={new Date(newTimestamp.checkInTime).toISOString().split('T')[0]}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            
                            // Uppdatera incheckningstid
                            const inTime = new Date(newTimestamp.checkInTime);
                            const newInDateTime = new Date(`${newDate}T${inTime.toTimeString().slice(0, 8)}`);
                            
                            // Uppdatera utcheckningstid om den finns
                            let newOutDateTime = null;
                            if (newTimestamp.checkOutTime) {
                              const outTime = new Date(newTimestamp.checkOutTime);
                              newOutDateTime = new Date(`${newDate}T${outTime.toTimeString().slice(0, 8)}`);
                            }
                            
                            // Uppdatera schemalagda tider
                            let newScheduledStart = null;
                            let newScheduledEnd = null;
                            
                            if (newTimestamp.shiftInfo?.scheduledStart) {
                              const schedStart = new Date(newTimestamp.shiftInfo.scheduledStart);
                              newScheduledStart = new Date(`${newDate}T${schedStart.toTimeString().slice(0, 8)}`);
                            }
                            
                            if (newTimestamp.shiftInfo?.scheduledEnd) {
                              const schedEnd = new Date(newTimestamp.shiftInfo.scheduledEnd);
                              newScheduledEnd = new Date(`${newDate}T${schedEnd.toTimeString().slice(0, 8)}`);
                            }
                            
                            setNewTimestamp({
                              ...newTimestamp,
                              checkInTime: newInDateTime.toISOString(),
                              checkOutTime: newOutDateTime ? newOutDateTime.toISOString() : null,
                              shiftInfo: {
                                ...newTimestamp.shiftInfo,
                                scheduledStart: newScheduledStart ? newScheduledStart.toISOString() : null,
                                scheduledEnd: newScheduledEnd ? newScheduledEnd.toISOString() : null,
                              }
                            });
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Incheckning</label>
                        <input
                          type="time"
                          value={new Date(newTimestamp.checkInTime).toTimeString().slice(0, 5)}
                          onChange={(e) => {
                            const oldDate = new Date(newTimestamp.checkInTime).toISOString().split('T')[0];
                            const newTime = e.target.value;
                            const newDateTime = new Date(`${oldDate}T${newTime}`);
                            
                            setNewTimestamp({
                              ...newTimestamp,
                              checkInTime: newDateTime.toISOString()
                            });
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Utcheckning</label>
                        <input
                          type="time"
                          value={newTimestamp.checkOutTime ? new Date(newTimestamp.checkOutTime).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => {
                            const oldDate = new Date(newTimestamp.checkInTime).toISOString().split('T')[0];
                            const newTime = e.target.value;
                            
                            let newOutDateTime = null;
                            if (newTime) {
                              newOutDateTime = new Date(`${oldDate}T${newTime}`);
                            }
                            
                            setNewTimestamp({
                              ...newTimestamp,
                              checkOutTime: newTime ? newOutDateTime.toISOString() : null
                            });
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Rast (minuter)</label>
                        <input
                          type="number"
                          value={newTimestamp.shiftInfo?.breakDuration || 0}
                          onChange={(e) => {
                            const newBreakDuration = e.target.value;
                            setNewTimestamp({
                              ...newTimestamp,
                              shiftInfo: {
                                ...newTimestamp.shiftInfo || {},
                                breakDuration: newBreakDuration
                              }
                            });
                          }}
                          min="0"
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h5 className="font-medium text-sm mb-2 text-gray-700">Schemalagd arbetstid</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Schemalagd start</label>
                        <input
                          type="time"
                          value={newTimestamp.shiftInfo?.scheduledStart ? new Date(newTimestamp.shiftInfo.scheduledStart).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => {
                            const oldDate = new Date(newTimestamp.checkInTime).toISOString().split('T')[0];
                            const newTime = e.target.value;
                            
                            let newScheduledStart = null;
                            if (newTime) {
                              newScheduledStart = new Date(`${oldDate}T${newTime}`);
                            }
                            
                            setNewTimestamp({
                              ...newTimestamp,
                              shiftInfo: {
                                ...newTimestamp.shiftInfo || {},
                                scheduledStart: newTime ? newScheduledStart.toISOString() : null
                              }
                            });
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Schemalagd slut</label>
                        <input
                          type="time"
                          value={newTimestamp.shiftInfo?.scheduledEnd ? new Date(newTimestamp.shiftInfo.scheduledEnd).toTimeString().slice(0, 5) : ''}
                          onChange={(e) => {
                            const oldDate = new Date(newTimestamp.checkInTime).toISOString().split('T')[0];
                            const newTime = e.target.value;
                            
                            let newScheduledEnd = null;
                            if (newTime) {
                              newScheduledEnd = new Date(`${oldDate}T${newTime}`);
                            }
                            
                            setNewTimestamp({
                              ...newTimestamp,
                              shiftInfo: {
                                ...newTimestamp.shiftInfo || {},
                                scheduledEnd: newTime ? newScheduledEnd.toISOString() : null
                              }
                            });
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <button
                      onClick={() => setShowNewTimestampForm(false)}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md mr-2"
                      disabled={loading}
                    >
                      Avbryt
                    </button>
                    <button
                      onClick={handleSaveNewTimestamp}
                      className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md"
                      disabled={loading}
                    >
                      Spara
                    </button>
                  </div>
                </div>
              )}
              
              {timestampsLoading ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : timestamps.length === 0 ? (
                <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500">
                  Inga tidsstämplingar hittades för denna period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Datum
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          In
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ut
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rast (min)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Schema
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Arbetstid
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Åtgärder
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {timestamps.map(ts => (
                        <tr key={ts.id} className={isMonthApproved() ? 'bg-green-50' : ''}>
                          {editingTimestamp && editingTimestamp.id === ts.id ? (
                            // Redigeringsläge
                            <>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <input
                                  type="date"
                                  value={new Date(editingTimestamp.checkInTime).toISOString().split('T')[0]}
                                  onChange={(e) => {
                                    const newDate = e.target.value;
                                    const oldTime = new Date(editingTimestamp.checkInTime).toTimeString().split(' ')[0];
                                    const newDateTime = new Date(`${newDate}T${oldTime}`);
                                    
                                    // Uppdatera även schemalagda tider
                                    let newScheduledStart = editingTimestamp.shiftInfo?.scheduledStart;
                                    let newScheduledEnd = editingTimestamp.shiftInfo?.scheduledEnd;
                                    
                                    if (newScheduledStart) {
                                      const schedStart = new Date(newScheduledStart);
                                      schedStart.setFullYear(
                                        newDateTime.getFullYear(), 
                                        newDateTime.getMonth(), 
                                        newDateTime.getDate()
                                      );
                                      newScheduledStart = schedStart.toISOString();
                                    }
                                    
                                    if (newScheduledEnd) {
                                      const schedEnd = new Date(newScheduledEnd);
                                      schedEnd.setFullYear(
                                        newDateTime.getFullYear(), 
                                        newDateTime.getMonth(), 
                                        newDateTime.getDate()
                                      );
                                      newScheduledEnd = schedEnd.toISOString();
                                    }
                                    
                                    setEditingTimestamp({
                                      ...editingTimestamp,
                                      checkInTime: newDateTime.toISOString(),
                                      shiftInfo: {
                                        ...editingTimestamp.shiftInfo || {},
                                        scheduledStart: newScheduledStart,
                                        scheduledEnd: newScheduledEnd
                                      }
                                    });
                                  }}
                                  className="px-2 py-1 border rounded w-full"
                                />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <input
                                  type="time"
                                  value={new Date(editingTimestamp.checkInTime).toTimeString().slice(0, 5)}
                                  onChange={(e) => {
                                    const oldDate = new Date(editingTimestamp.checkInTime).toISOString().split('T')[0];
                                    const newTime = e.target.value;
                                    const newDateTime = new Date(`${oldDate}T${newTime}`);
                                    setEditingTimestamp({
                                      ...editingTimestamp,
                                      checkInTime: newDateTime.toISOString()
                                    });
                                  }}
                                  className="px-2 py-1 border rounded w-full"
                                />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <input
                                  type="time"
                                  value={editingTimestamp.checkOutTime ? new Date(editingTimestamp.checkOutTime).toTimeString().slice(0, 5) : ''}
                                  onChange={(e) => {
                                    const oldDate = new Date(editingTimestamp.checkInTime).toISOString().split('T')[0];
                                    const newTime = e.target.value;
                                    const newDateTime = new Date(`${oldDate}T${newTime}`);
                                    setEditingTimestamp({
                                      ...editingTimestamp,
                                      checkOutTime: newTime ? newDateTime.toISOString() : null
                                    });
                                  }}
                                  className="px-2 py-1 border rounded w-full"
                                />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <input
                                  type="number"
                                  value={editingTimestamp.shiftInfo?.breakDuration || 0}
                                  onChange={(e) => {
                                    const newBreakDuration = e.target.value;
                                    setEditingTimestamp({
                                      ...editingTimestamp,
                                      shiftInfo: {
                                        ...editingTimestamp.shiftInfo || {},
                                        breakDuration: newBreakDuration
                                      }
                                    });
                                  }}
                                  min="0"
                                  className="px-2 py-1 border rounded w-full"
                                />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <input
                                    type="time"
                                    value={editingTimestamp.shiftInfo?.scheduledStart ? new Date(editingTimestamp.shiftInfo.scheduledStart).toTimeString().slice(0, 5) : ''}
                                    onChange={(e) => {
                                      const oldDate = new Date(editingTimestamp.checkInTime).toISOString().split('T')[0];
                                      const newTime = e.target.value;
                                      const newDateTime = newTime ? new Date(`${oldDate}T${newTime}`) : null;
                                      
                                      setEditingTimestamp({
                                        ...editingTimestamp,
                                        shiftInfo: {
                                          ...editingTimestamp.shiftInfo || {},
                                          scheduledStart: newDateTime ? newDateTime.toISOString() : null
                                        }
                                      });
                                    }}
                                    placeholder="Start"
                                    className="px-2 py-1 border rounded w-full text-xs"
                                  />
                                  <input
                                    type="time"
                                    value={editingTimestamp.shiftInfo?.scheduledEnd ? new Date(editingTimestamp.shiftInfo.scheduledEnd).toTimeString().slice(0, 5) : ''}
                                    onChange={(e) => {
                                      const oldDate = new Date(editingTimestamp.checkInTime).toISOString().split('T')[0];
                                      const newTime = e.target.value;
                                      const newDateTime = newTime ? new Date(`${oldDate}T${newTime}`) : null;
                                      
                                      setEditingTimestamp({
                                        ...editingTimestamp,
                                        shiftInfo: {
                                          ...editingTimestamp.shiftInfo || {},
                                          scheduledEnd: newDateTime ? newDateTime.toISOString() : null
                                        }
                                      });
                                    }}
                                    placeholder="Slut"
                                    className="px-2 py-1 border rounded w-full text-xs"
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                {editingTimestamp.checkOutTime 
                                  ? utils.timestampToHours(
                                     editingTimestamp.checkInTime, 
                                     editingTimestamp.checkOutTime,
                                     editingTimestamp.shiftInfo?.breakDuration || 0
                                   ).toFixed(2) + ' h' 
                                  : 'Pågående'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={handleSaveTimestamp}
                                    className="text-green-600 hover:text-green-900"
                                    disabled={loading}
                                  >
                                    Spara
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="text-gray-600 hover:text-gray-900"
                                    disabled={loading}
                                  >
                                    Avbryt
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            // Visningsläge
                            <>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {new Date(ts.checkInTime).toLocaleDateString('sv-SE')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {new Date(ts.checkInTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {ts.checkOutTime 
                                  ? new Date(ts.checkOutTime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})
                                  : 'Pågående'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {ts.shiftInfo?.breakDuration || '0'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {ts.shiftInfo?.scheduledStart && ts.shiftInfo?.scheduledEnd ? (
                                  <>
                                    {new Date(ts.shiftInfo.scheduledStart).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}
                                    {' - '}
                                    {new Date(ts.shiftInfo.scheduledEnd).toLocaleTimeString('sv-SE', {hour: '2-digit', minute: '2-digit'})}
                                  </>
                                ) : (
                                  ts.shiftInfo?.startTime && ts.shiftInfo?.endTime ? (
                                    <>
                                      {ts.shiftInfo.startTime}
                                      {' - '}
                                      {ts.shiftInfo.endTime}
                                    </>
                                  ) : (
                                    <span className="text-gray-400">Ej angivet</span>
                                  )
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                {ts.checkOutTime 
                                  ? utils.timestampToHours(ts.checkInTime, ts.checkOutTime, ts.shiftInfo?.breakDuration || 0).toFixed(2) + ' h'
                                  : 'Pågående'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleEditTimestamp(ts)}
                                    className="text-blue-600 hover:text-blue-900"
                                    disabled={loading || isMonthApproved()}
                                  >
                                    Ändra
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTimestamp(ts.id)}
                                    className="text-red-600 hover:text-red-900"
                                    disabled={loading || isMonthApproved()}
                                  >
                                    Radera
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Summering */}
              {timestamps.length > 0 && (
                <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Summering</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Antal pass:</span>
                      <p className="font-medium">{timestamps.length}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Total arbetstid:</span>
                      <p className="font-medium">
                        {timestamps.reduce((sum, ts) => {
                          if (ts.checkOutTime) {
                            return sum + utils.timestampToHours(
                              ts.checkInTime, 
                              ts.checkOutTime, 
                              ts.shiftInfo?.breakDuration || 0
                            );
                          }
                          return sum;
                        }, 0).toFixed(2)} timmar
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Status:</span>
                      <p className="font-medium">
                        {isMonthApproved() ? (
                          <span className="text-green-600">Godkänd</span>
                        ) : (
                          <span className="text-yellow-600">Ej godkänd</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
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