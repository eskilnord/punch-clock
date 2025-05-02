// Utility functions for stämpelklocka

// Create the utils object
const utils = {
  // Format date to YYYY-MM-DD
  formatDate: (date) => {
    return date.toISOString().split('T')[0];
  },
  
  // Format time to HH:MM
  formatTime: (date) => {
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  },
  
  // Normalize personnummer to YYYYMMDD-XXXX format
  normalizePersonnummer: (personnummer) => {
    // Remove all spaces
    let pnr = personnummer.trim().replace(/\s+/g, '');
    
    // Om det är ett samordningsnummer eller utländskt personnummer
    // kan vi tillåta specialformat, men vi behåller grundreglerna
    
    // If it already contains a hyphen, we'll check if it's in the right format
    if (pnr.includes('-')) {
      const parts = pnr.split('-');
      if (parts.length !== 2) {
        throw new Error('Ogiltigt personnummer format');
      }
      
      let firstPart = parts[0];
      const secondPart = parts[1];
      
      // Om vi har ett utländskt format där första delen kan innehålla bokstäver
      const isNonNumericFirst = /[^0-9]/.test(firstPart);
      
      if (!isNonNumericFirst) {
        // Traditionellt personnummer format
        // If first part is 6 digits (YYMMDD)
        if (firstPart.length === 6) {
          // Convert to YYYYMMDD by determining the century
          const yy = parseInt(firstPart.substring(0, 2), 10);
          const currentYear = new Date().getFullYear();
          const century = yy > (currentYear % 100) ? '19' : '20';
          firstPart = century + firstPart;
        } else if (firstPart.length !== 8) {
          throw new Error('Ogiltigt personnummer format');
        }
      } else {
        // Utländskt format - behåll som det är
        // För utländska format accepterar vi alla första delar
      }
      
      // För den andra delen accepterar vi:
      // 1. 4 siffror (standard)
      // 2. Alfanumeriska kombinationer för utländska IDs (t.ex. "A123")
      
      // Tillåt mer flexibla andra delar för utländska personnummer
      // men se till att den innehåller minst en bokstav eller siffra
      if (secondPart.length === 0 || secondPart.length > 6) {
        throw new Error('Ogiltigt format på andra delen av numret');
      }
      
      return `${firstPart}-${secondPart}`;
    } 
    
    // No hyphen in the input
    if (pnr.length === 10 && /^\d+$/.test(pnr)) {
      // Assuming YYMMDDXXXX format, convert to YYYYMMDD-XXXX
      const yy = parseInt(pnr.substring(0, 2), 10);
      const currentYear = new Date().getFullYear();
      const century = yy > (currentYear % 100) ? '19' : '20';
      return `${century}${pnr.substring(0, 6)}-${pnr.substring(6, 10)}`;
    } else if (pnr.length === 12 && /^\d+$/.test(pnr)) {
      // Assuming YYYYMMDDXXXX format, convert to YYYYMMDD-XXXX
      return `${pnr.substring(0, 8)}-${pnr.substring(8, 12)}`;
    } else {
      // För utländska personnummer utan bindestreck
      // Om det är alfanumeriskt och minst 6 tecken, gör ett försök att dela upp det
      if (pnr.length >= 6) {
        // För enkelhets skull delar vi det vid position 6 om det är alfanumeriskt
        return `${pnr.substring(0, 6)}-${pnr.substring(6)}`;
      }
    }
    
    throw new Error('Ogiltigt personnummer format');
  },
  
  // Validate personnummer
  validatePersonnummer: (personnummer) => {
    try {
      // För utländska och samordningsnummer gör vi en enklare validering
      const trimmed = personnummer.trim();
      if (trimmed.length < 6) {
        return false; // Minst 6 tecken krävs för ett giltigt ID
      }
      
      utils.normalizePersonnummer(personnummer);
      return true;
    } catch (error) {
      return false;
    }
  },
  
  // Detect if an ID is a coordination number (samordningsnummer)
  isSamordningsnummer: (personnummer) => {
    try {
      const normalized = utils.normalizePersonnummer(personnummer);
      const datePart = normalized.split('-')[0];
      
      if (datePart.length !== 8) return false;
      
      // I samordningsnummer läggs 60 till på dagen
      const day = parseInt(datePart.substring(6, 8), 10);
      return day > 60 && day <= 91;
    } catch (error) {
      return false;
    }
  },
  
  // Convert timestamp to hours
  timestampToHours: (checkInTime, checkOutTime, breakDuration = 0) => {
    if (!checkInTime || !checkOutTime) return 0;
    
    const start = new Date(checkInTime);
    const end = new Date(checkOutTime);
    
    // Calculate total minutes
    const durationMinutes = (end - start) / (1000 * 60);
    
    // Subtract break duration
    const workMinutes = durationMinutes - parseInt(breakDuration, 10);
    
    // Convert to hours with 2 decimal places
    return +(workMinutes / 60).toFixed(2);
  },
  
  // Generate a CSV file
  generateCSV: (data, headers) => {
    let csv = headers.join(',') + '\n';
    
    data.forEach(row => {
      csv += headers.map(header => {
        const value = row[header] !== undefined ? row[header] : '';
        // Quote values with commas
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',') + '\n';
    });
    
    return csv;
  },
  
  // Download data as a file
  downloadFile: (data, filename, type = 'text/csv') => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
    URL.revokeObjectURL(url);
    return filename;
  },
  
  // Generate attendance report
  generateAttendanceReport: async () => {
    const timestamps = await dbService.getAllTimestamps();
    const employees = await dbService.getAllEmployees();
    
    // Create a map of employees for quick lookups
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.personnummer] = emp.name || emp.personnummer;
    });
    
    // Transform timestamps for report
    const reportData = timestamps.map(ts => {
      return {
        Datum: new Date(ts.checkInTime).toLocaleDateString('sv-SE'),
        Medarbetare: employeeMap[ts.personnummer] || ts.personnummer,
        Personnummer: ts.personnummer,
        Instämpling: new Date(ts.checkInTime).toLocaleTimeString('sv-SE'),
        Utstämpling: ts.checkOutTime ? new Date(ts.checkOutTime).toLocaleTimeString('sv-SE') : 'Pågående',
        Arbetstid: ts.checkOutTime ? utils.timestampToHours(ts.checkInTime, ts.checkOutTime, 
          ts.shiftInfo?.breakDuration || 0) + ' h' : 'Pågående',
        Anteckningar: ts.shiftInfo?.notes || ''
      };
    });
    
    // Sort by date and employee
    reportData.sort((a, b) => {
      const dateCompare = new Date(b.Datum) - new Date(a.Datum);
      if (dateCompare !== 0) return dateCompare;
      return a.Medarbetare.localeCompare(b.Medarbetare);
    });
    
    const headers = ['Datum', 'Medarbetare', 'Personnummer', 'Instämpling', 'Utstämpling', 'Arbetstid', 'Anteckningar'];
    const csv = utils.generateCSV(reportData, headers);
    
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `närvarorapport_${dateStr}.csv`;
    
    return utils.downloadFile(csv, filename);
  },
  
  // Generate work hours summary
  generateWorkHoursSummary: async (startDate, endDate) => {
    const timestamps = await dbService.getAllTimestamps();
    const employees = await dbService.getAllEmployees();
    
    // Create a map of employees for quick lookups
    const employeeMap = {};
    employees.forEach(emp => {
      employeeMap[emp.personnummer] = emp.name || emp.personnummer;
    });
    
    // Filter timestamps by date range
    const filteredTimestamps = timestamps.filter(ts => {
      const date = new Date(ts.checkInTime).toISOString().split('T')[0];
      return date >= startDate && date <= endDate;
    });
    
    // Group by employee and summarize hours
    const employeeSummary = {};
    filteredTimestamps.forEach(ts => {
      const employeeId = ts.personnummer;
      
      if (!employeeSummary[employeeId]) {
        employeeSummary[employeeId] = {
          Personnummer: employeeId,
          Medarbetare: employeeMap[employeeId] || employeeId,
          TotalTimmar: 0,
          AntalPass: 0
        };
      }
      
      if (ts.checkOutTime) {
        employeeSummary[employeeId].TotalTimmar += utils.timestampToHours(
          ts.checkInTime, ts.checkOutTime, ts.shiftInfo?.breakDuration || 0
        );
        employeeSummary[employeeId].AntalPass += 1;
      }
    });
    
    // Convert to array for CSV
    const reportData = Object.values(employeeSummary);
    
    // Sort by total hours
    reportData.sort((a, b) => b.TotalTimmar - a.TotalTimmar);
    
    const headers = ['Medarbetare', 'Personnummer', 'TotalTimmar', 'AntalPass'];
    const csv = utils.generateCSV(reportData, headers);
    
    const filename = `arbetstidssammanställning_${startDate}_till_${endDate}.csv`;
    
    return utils.downloadFile(csv, filename);
  }
};

// Export the utils
window.utils = utils; 