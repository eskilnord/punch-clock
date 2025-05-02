// Utility functions for the application

// Normalize Swedish personnummer to standard format YYYYMMDD-XXXX
const normalizePersonnummer = (personnummer) => {
  // Remove all non-digits first
  const digits = personnummer.replace(/\D/g, '');
  
  // Handle 10 digit format (YYMMDDXXXX) - add century
  if (digits.length === 10) {
    const yy = parseInt(digits.substring(0, 2));
    // If year is greater than current year's last two digits, assume 19xx, otherwise 20xx
    const century = (yy > new Date().getFullYear() % 100) ? '19' : '20';
    const formattedNum = century + digits.substring(0, 6) + '-' + digits.substring(6);
    return formattedNum;
  }
  
  // Handle 12 digit format (YYYYMMDDXXXX) - add hyphen
  if (digits.length === 12) {
    return digits.substring(0, 8) + '-' + digits.substring(8);
  }
  
  // If it already has a hyphen but might be in YY format
  if (personnummer.includes('-')) {
    const parts = personnummer.split('-');
    if (parts[0].length === 6) {
      // YY format with hyphen, add century
      const yy = parseInt(parts[0].substring(0, 2));
      const century = (yy > new Date().getFullYear() % 100) ? '19' : '20';
      return century + parts[0] + '-' + parts[1];
    }
  }
  
  // Return original if it already has correct format
  return personnummer;
};

// Validate Swedish personnummer (accepts multiple formats)
const validatePersonnummer = (personnummer) => {
  // First normalize the input
  const normalized = normalizePersonnummer(personnummer);
  
  // Then check if it matches the standard format
  const regex = /^(19|20)\d{6}-\d{4}$/;
  return regex.test(normalized);
};

// Format date for display
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('sv-SE');
};

// Format time for display
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
};

// Calculate worked hours between two timestamps
const calculateWorkedHours = (inTime, outTime) => {
  if (!inTime || !outTime) return 0;
  
  const inDate = new Date(inTime);
  const outDate = new Date(outTime);
  const diffMs = outDate - inDate;
  
  // Convert to hours and minutes
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return { hours, minutes, totalHours: hours + (minutes / 60) };
};

// Group timestamps by date and personnummer
const groupTimestampsByDay = (timestamps) => {
  const grouped = {};
  
  timestamps.forEach(stamp => {
    const date = stamp.date;
    const personnummer = stamp.personnummer;
    const key = `${date}_${personnummer}`;
    
    if (!grouped[key]) {
      grouped[key] = { 
        date, 
        personnummer,
        stamps: []
      };
    }
    
    grouped[key].stamps.push(stamp);
  });
  
  // Sort stamps by timestamp for each day
  Object.values(grouped).forEach(day => {
    day.stamps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  });
  
  return Object.values(grouped);
};

// Create pairs of in/out timestamps
const createInOutPairs = (groupedTimestamps) => {
  const pairs = [];
  
  groupedTimestamps.forEach(day => {
    let currentPair = { date: day.date, personnummer: day.personnummer };
    
    day.stamps.forEach(stamp => {
      if (stamp.type === 'in' && !currentPair.inTime) {
        currentPair.inTime = stamp.timestamp;
      } else if (stamp.type === 'out' && currentPair.inTime && !currentPair.outTime) {
        currentPair.outTime = stamp.timestamp;
        
        // Calculate worked hours
        const { hours, minutes, totalHours } = calculateWorkedHours(currentPair.inTime, currentPair.outTime);
        currentPair.workedHours = { hours, minutes, totalHours };
        
        pairs.push({...currentPair});
        currentPair = { date: day.date, personnummer: day.personnummer };
      }
    });
    
    // Add incomplete pair if there's an in stamp without out
    if (currentPair.inTime && !currentPair.outTime) {
      pairs.push({...currentPair});
    }
  });
  
  return pairs;
};

// Generate attendance report PDF
const generateAttendanceReport = async () => {
  const employees = await dbService.getAllEmployees();
  const timestamps = await dbService.getAllTimestamps();
  
  // Process timestamps
  const groupedByDay = groupTimestampsByDay(timestamps);
  const inOutPairs = createInOutPairs(groupedByDay);
  
  // Create PDF
  const doc = new jspdf.jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text('Närvarorapport', 14, 20);
  doc.setFontSize(12);
  doc.text(`Genererad: ${formatDate(new Date())}`, 14, 30);
  
  // Create table data
  const tableData = inOutPairs.map(pair => [
    pair.personnummer, 
    formatDate(pair.date),
    pair.inTime ? formatTime(pair.inTime) : '-',
    pair.outTime ? formatTime(pair.outTime) : '-',
    pair.workedHours ? `${pair.workedHours.hours}h ${pair.workedHours.minutes}m` : '-'
  ]);
  
  // Add table
  doc.autoTable({
    startY: 40,
    head: [['Personnummer', 'Datum', 'Stämplat in', 'Stämplat ut', 'Arbetstid']],
    body: tableData,
  });
  
  // Save PDF
  const filename = `Narvaro_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  
  return filename;
};

// Generate work hours summary report PDF
const generateWorkHoursSummary = async (startDate, endDate) => {
  const employees = await dbService.getAllEmployees();
  const timestamps = await dbService.getTimestampsByDate(startDate, endDate);
  
  // Process timestamps
  const groupedByDay = groupTimestampsByDay(timestamps);
  const inOutPairs = createInOutPairs(groupedByDay);
  
  // Calculate total hours per employee
  const hoursPerEmployee = {};
  
  inOutPairs.forEach(pair => {
    if (!pair.workedHours) return;
    
    if (!hoursPerEmployee[pair.personnummer]) {
      hoursPerEmployee[pair.personnummer] = { 
        totalHours: 0, 
        totalMinutes: 0
      };
    }
    
    hoursPerEmployee[pair.personnummer].totalHours += pair.workedHours.hours;
    hoursPerEmployee[pair.personnummer].totalMinutes += pair.workedHours.minutes;
  });
  
  // Normalize minutes to hours
  Object.values(hoursPerEmployee).forEach(employee => {
    const extraHours = Math.floor(employee.totalMinutes / 60);
    employee.totalHours += extraHours;
    employee.totalMinutes %= 60;
  });
  
  // Create PDF
  const doc = new jspdf.jsPDF();
  
  // Add title
  doc.setFontSize(16);
  doc.text('Sammanställning av arbetstimmar', 14, 20);
  doc.setFontSize(12);
  doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, 30);
  
  // Create table data
  const tableData = Object.entries(hoursPerEmployee).map(([personnummer, hours]) => [
    personnummer,
    `${hours.totalHours}h ${hours.totalMinutes}m`
  ]);
  
  // Add table
  doc.autoTable({
    startY: 40,
    head: [['Personnummer', 'Total arbetstid']],
    body: tableData,
  });
  
  // Save PDF
  const filename = `Arbetstimmar_${startDate}_${endDate}.pdf`;
  doc.save(filename);
  
  return filename;
};

// Export utilities
window.utils = {
  validatePersonnummer,
  normalizePersonnummer,
  formatDate,
  formatTime,
  calculateWorkedHours,
  generateAttendanceReport,
  generateWorkHoursSummary
}; 