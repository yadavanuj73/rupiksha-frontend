export interface ApiEmployee {
  _id?: string;
  id: string;
  role: "ADMIN" | "NATIONAL" | "STATE" | "REGIONAL";
  status?: "ACTIVE" | "INACTIVE" | string;
  photoUrl?: string;
  fullName?: string;
  territory?: string;
  phone?: string;
  email?: string;
  lastLogin?: string;
  totalUsers?: number;
  totalTxns?: number;
  networkWallet?: number;
  address?: string;
}

export interface ApiUserLocation {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
}

export interface EmployeeService {
  getAll: () => Promise<ApiEmployee[]>;
  getById: (id: string) => Promise<ApiEmployee>;
  create: (userData: unknown) => Promise<unknown>;
  update: (id: string, userData: unknown) => Promise<unknown>;
  toggleStatus: (id: string) => Promise<unknown>;
  delete: (id: string) => Promise<unknown>;
  getPermissions: (userId: string) => Promise<unknown>;
  updatePermissions: (userId: string, permissions: unknown) => Promise<unknown>;
}

export interface LocationService {
  updateMyLocation: (lat: number, lng: number) => Promise<unknown>;
  getAllLocations: () => Promise<ApiUserLocation[]>;
  getUserLocation: (userId: string) => Promise<ApiUserLocation>;
}

export const employeeService: EmployeeService;
export const locationService: LocationService;
