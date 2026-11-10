export type MeasurementSiteKey =
  | 'waist'
  | 'chest'
  | 'shoulders'
  | 'bicep_left'
  | 'bicep_right'
  | 'forearm_left'
  | 'forearm_right'
  | 'neck'
  | 'hips'
  | 'thigh_left'
  | 'thigh_right'
  | 'calf_left'
  | 'calf_right'

export interface MeasurementSiteMeta {
  key: MeasurementSiteKey
  field: keyof Omit<BodyMeasurement, 'id' | 'userId' | 'measuredDate' | 'notes' | 'createdAt' | 'updatedAt'>
  dbField: keyof Omit<DbBodyMeasurement, 'id' | 'user_id' | 'measured_date' | 'notes' | 'created_at' | 'updated_at'>
  label: string
  category: 'torso' | 'arms' | 'legs'
  minCm: number
  maxCm: number
  description: string
}

export const MEASUREMENT_SITES: MeasurementSiteMeta[] = [
  {
    key: 'waist',
    field: 'waistCm',
    dbField: 'waist_cm',
    label: 'Waist',
    category: 'torso',
    minCm: 40,
    maxCm: 250,
    description: 'Measured at narrowest point or navel level',
  },
  {
    key: 'chest',
    field: 'chestCm',
    dbField: 'chest_cm',
    label: 'Chest',
    category: 'torso',
    minCm: 50,
    maxCm: 250,
    description: 'Measured across nipple line with relaxed breathing',
  },
  {
    key: 'shoulders',
    field: 'shouldersCm',
    dbField: 'shoulders_cm',
    label: 'Shoulders',
    category: 'torso',
    minCm: 60,
    maxCm: 250,
    description: 'Circumference around the widest point of the deltoids',
  },
  {
    key: 'neck',
    field: 'neckCm',
    dbField: 'neck_cm',
    label: 'Neck',
    category: 'torso',
    minCm: 20,
    maxCm: 80,
    description: 'Measured midway along neck, just below Adams apple',
  },
  {
    key: 'hips',
    field: 'hipsCm',
    dbField: 'hips_cm',
    label: 'Hips',
    category: 'torso',
    minCm: 50,
    maxCm: 250,
    description: 'Widest circumference around buttocks and hips',
  },
  {
    key: 'bicep_left',
    field: 'bicepLeftCm',
    dbField: 'bicep_left_cm',
    label: 'Left Bicep',
    category: 'arms',
    minCm: 15,
    maxCm: 80,
    description: 'Flexed arm at peak bicep circumference',
  },
  {
    key: 'bicep_right',
    field: 'bicepRightCm',
    dbField: 'bicep_right_cm',
    label: 'Right Bicep',
    category: 'arms',
    minCm: 15,
    maxCm: 80,
    description: 'Flexed arm at peak bicep circumference',
  },
  {
    key: 'forearm_left',
    field: 'forearmLeftCm',
    dbField: 'forearm_left_cm',
    label: 'Left Forearm',
    category: 'arms',
    minCm: 12,
    maxCm: 60,
    description: 'Widest point below elbow with hand open',
  },
  {
    key: 'forearm_right',
    field: 'forearmRightCm',
    dbField: 'forearm_right_cm',
    label: 'Right Forearm',
    category: 'arms',
    minCm: 12,
    maxCm: 60,
    description: 'Widest point below elbow with hand open',
  },
  {
    key: 'thigh_left',
    field: 'thighLeftCm',
    dbField: 'thigh_left_cm',
    label: 'Left Thigh',
    category: 'legs',
    minCm: 25,
    maxCm: 120,
    description: 'Widest circumference of upper thigh below glute fold',
  },
  {
    key: 'thigh_right',
    field: 'thighRightCm',
    dbField: 'thigh_right_cm',
    label: 'Right Thigh',
    category: 'legs',
    minCm: 25,
    maxCm: 120,
    description: 'Widest circumference of upper thigh below glute fold',
  },
  {
    key: 'calf_left',
    field: 'calfLeftCm',
    dbField: 'calf_left_cm',
    label: 'Left Calf',
    category: 'legs',
    minCm: 15,
    maxCm: 80,
    description: 'Widest circumference of gastrocnemius standing',
  },
  {
    key: 'calf_right',
    field: 'calfRightCm',
    dbField: 'calf_right_cm',
    label: 'Right Calf',
    category: 'legs',
    minCm: 15,
    maxCm: 80,
    description: 'Widest circumference of gastrocnemius standing',
  },
]

export interface BodyMeasurement {
  id: string
  userId: string
  measuredDate: string // YYYY-MM-DD
  waistCm: number | null
  chestCm: number | null
  shouldersCm: number | null
  bicepLeftCm: number | null
  bicepRightCm: number | null
  forearmLeftCm: number | null
  forearmRightCm: number | null
  neckCm: number | null
  hipsCm: number | null
  thighLeftCm: number | null
  thighRightCm: number | null
  calfLeftCm: number | null
  calfRightCm: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface DbBodyMeasurement {
  id: string
  user_id: string
  measured_date: string
  waist_cm: number | null
  chest_cm: number | null
  shoulders_cm: number | null
  bicep_left_cm: number | null
  bicep_right_cm: number | null
  forearm_left_cm: number | null
  forearm_right_cm: number | null
  neck_cm: number | null
  hips_cm: number | null
  thigh_left_cm: number | null
  thigh_right_cm: number | null
  calf_left_cm: number | null
  calf_right_cm: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type PhotoPose = 'front' | 'side' | 'back'

export interface ProgressPhoto {
  id: string
  userId: string
  capturedDate: string // YYYY-MM-DD
  pose: PhotoPose
  storagePath: string
  signedUrl?: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface DbProgressPhoto {
  id: string
  user_id: string
  captured_date: string
  pose: PhotoPose
  storage_path: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AddMeasurementPayload {
  measuredDate: string
  waistCm?: number | null
  chestCm?: number | null
  shouldersCm?: number | null
  bicepLeftCm?: number | null
  bicepRightCm?: number | null
  forearmLeftCm?: number | null
  forearmRightCm?: number | null
  neckCm?: number | null
  hipsCm?: number | null
  thighLeftCm?: number | null
  thighRightCm?: number | null
  calfLeftCm?: number | null
  calfRightCm?: number | null
  notes?: string | null
}

export interface UpdateMeasurementPayload extends Partial<AddMeasurementPayload> {
  id: string
}

export interface UploadPhotoPayload {
  capturedDate: string
  pose: PhotoPose
  file: File
  notes?: string | null
}

export interface MeasurementSiteDelta {
  key: MeasurementSiteKey
  label: string
  currentCm: number | null
  previousCm: number | null
  diffCm: number | null
  pctChange: number | null
}

export interface SessionComparisonResult {
  dateA: string
  dateB: string
  daysBetween: number
  sites: {
    key: MeasurementSiteKey
    label: string
    valACm: number | null
    valBCm: number | null
    diffCm: number | null
    pctChange: number | null
  }[]
  weightKgA: number | null
  weightKgB: number | null
  weightDiffKg: number | null
}

