export interface Table {
  id: string;
  name: string;
  status: 'TRỐNG' | 'CÓ KHÁCH';
  dwellTime: number; // in minutes
  activityLevel: 'Thấp' | 'Vừa' | 'Cao';
  totalGuestsToday: number;
  currentGuests: number;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  totalTables: number;
  capacity: number;
  status: 'active' | 'closed';
}

export interface TimeSeriesDataPoint {
  time: string;
  value: number;
}

export interface PeakHourDataPoint {
  time: string;
  actual: number;
  capacity: number;
}

export interface HeatmapRow {
  day: string;
  hours: number[];
}

export interface DashboardData {
  tables: Table[];
  timeSeriesData: {
    headcount: TimeSeriesDataPoint[];
    occupancy: TimeSeriesDataPoint[];
    avgDwell: TimeSeriesDataPoint[];
  };
  efficiencyMetrics: {
    seatUtilization: number;
    avgTurnover: number;
    targetTurnover: number;
    serviceVelocity: {
      eating: number;
      idle: number;
    };
  };
  strategicData: {
    heatmap: HeatmapRow[];
    peakHour: PeakHourDataPoint[];
  };
}

// Generate branch data
export function generateBranches(): Branch[] {
  return [
    {
      id: 'branch-001',
      name: 'Chi nhánh Quận 1 - Nguyễn Huệ',
      address: '123 Nguyễn Huệ, Q.1, TP.HCM',
      totalTables: 8,
      capacity: 32,
      status: 'active',
    },
    {
      id: 'branch-002',
      name: 'Chi nhánh Quận 3 - Võ Văn Tần',
      address: '456 Võ Văn Tần, Q.3, TP.HCM',
      totalTables: 10,
      capacity: 40,
      status: 'active',
    },
    {
      id: 'branch-003',
      name: 'Chi nhánh Bình Thạnh - Điện Biên Phủ',
      address: '789 Điện Biên Phủ, Bình Thạnh, TP.HCM',
      totalTables: 12,
      capacity: 48,
      status: 'active',
    },
    {
      id: 'branch-004',
      name: 'Chi nhánh Phú Nhuận - Phan Xích Long',
      address: '321 Phan Xích Long, Phú Nhuận, TP.HCM',
      totalTables: 8,
      capacity: 32,
      status: 'active',
    },
  ];
}

const activityLevels: ('Thấp' | 'Vừa' | 'Cao')[] = ['Thấp', 'Vừa', 'Cao'];

// Generate random table data
function generateTables(): Table[] {
  const tables: Table[] = [];
  
  for (let i = 1; i <= 8; i++) {
    const isOccupied = Math.random() > 0.3; // 70% chance occupied
    // Occasionally generate tables with >90 mins for smart alerts
    const dwellTime = isOccupied 
      ? (Math.random() > 0.8 ? Math.floor(Math.random() * 30) + 90 : Math.floor(Math.random() * 80) + 10)
      : 0;
    const currentGuests = isOccupied ? Math.floor(Math.random() * 4) + 1 : 0;
    
    tables.push({
      id: `table-${i.toString().padStart(2, '0')}`,
      name: `Bàn ${i.toString().padStart(2, '0')}`,
      status: isOccupied ? 'CÓ KHÁCH' : 'TRỐNG',
      dwellTime,
      activityLevel: isOccupied 
        ? activityLevels[Math.floor(Math.random() * activityLevels.length)]
        : 'Thấp',
      totalGuestsToday: Math.floor(Math.random() * 20) + 5,
      currentGuests,
    });
  }
  
  return tables;
}

// Generate time series data for charts
function generateTimeSeriesData() {
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  
  const headcount = hours.map(time => ({
    time,
    value: Math.floor(Math.random() * 40) + 10,
  }));
  
  const occupancy = hours.map(time => ({
    time,
    value: Math.floor(Math.random() * 40) + 50, // 50-90%
  }));
  
  const avgDwell = hours.map(time => ({
    time,
    value: Math.floor(Math.random() * 30) + 30, // 30-60 minutes
  }));
  
  return { headcount, occupancy, avgDwell };
}

// Generate efficiency metrics
function generateEfficiencyMetrics() {
  return {
    seatUtilization: Math.floor(Math.random() * 25) + 65, // 65-90%
    avgTurnover: Math.random() * 2 + 2.5, // 2.5-4.5
    targetTurnover: 4.0,
    serviceVelocity: {
      eating: Math.floor(Math.random() * 15) + 40, // 40-55 mins
      idle: Math.floor(Math.random() * 10) + 10, // 10-20 mins
    },
  };
}

// Generate heatmap data for demand analysis
function generateHeatmapData(): HeatmapRow[] {
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const hours = 14; // 8am to 9pm
  
  return days.map(day => ({
    day,
    hours: Array.from({ length: hours }, () => {
      // Simulate higher demand during lunch (11-13) and dinner (18-20)
      const hour = Math.floor(Math.random() * hours);
      if (hour >= 3 && hour <= 5) return Math.floor(Math.random() * 30) + 60; // Lunch
      if (hour >= 10 && hour <= 12) return Math.floor(Math.random() * 30) + 70; // Dinner
      return Math.floor(Math.random() * 50) + 20; // Other times
    }),
  }));
}

// Generate peak hour performance data (7 days)
function generatePeakHourData(): PeakHourDataPoint[] {
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const capacity = 32; // 8 tables * 4 seats average
  
  return days.map(day => ({
    time: day,
    actual: Math.floor(Math.random() * 15) + 20, // 20-35 customers
    capacity,
  }));
}

export function generateMockData(): DashboardData {
  return {
    tables: generateTables(),
    timeSeriesData: generateTimeSeriesData(),
    efficiencyMetrics: generateEfficiencyMetrics(),
    strategicData: {
      heatmap: generateHeatmapData(),
      peakHour: generatePeakHourData(),
    },
  };
}

// Calculate KPIs from table data
export function calculateKPIs(tables: Table[]) {
  const totalTables = tables.length;
  const occupiedTables = tables.filter(t => t.status === 'CÓ KHÁCH').length;
  const occupancyRate = Math.round((occupiedTables / totalTables) * 100);
  
  const totalHeadcount = tables.reduce((sum, t) => sum + t.currentGuests, 0);
  
  const occupiedTablesData = tables.filter(t => t.status === 'CÓ KHÁCH');
  const avgDwellTime = occupiedTablesData.length > 0
    ? Math.round(occupiedTablesData.reduce((sum, t) => sum + t.dwellTime, 0) / occupiedTablesData.length)
    : 0;
  
  return {
    occupancyRate,
    totalHeadcount,
    avgDwellTime,
  };
}