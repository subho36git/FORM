/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react'
import type { UnitSystem } from '@/types'

export interface UnitContextType {
  unitSystem: UnitSystem
  setUnitSystem: (system: UnitSystem) => void
  weightUnit: 'kg' | 'lb'
  heightUnit: 'cm' | 'ft-in'
  circumferenceUnit: 'cm' | 'in'
  formatWeight: (kg: number | null | undefined, options?: { showUnit?: boolean; decimals?: number }) => string
  formatHeight: (cm: number | null | undefined, options?: { showUnit?: boolean }) => string
  formatCircumference: (cm: number | null | undefined, options?: { showUnit?: boolean; decimals?: number }) => string
  kgToDisplay: (kg: number) => number
  displayToKg: (val: number) => number
  cmToDisplay: (cm: number) => { feet: number; inches: number }
  displayToCm: (feet: number, inches: number) => number
  cmToCircumferenceDisplay: (cm: number) => number
  circumferenceDisplayToCm: (val: number) => number
}

const STORAGE_KEY = 'form_unit_system'
const KG_TO_LB = 2.20462262
const INCH_TO_CM = 2.54

export const UnitContext = createContext<UnitContextType | undefined>(undefined)

export const UnitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(() => {
    if (typeof window === 'undefined') return 'metric'
    const stored = localStorage.getItem(STORAGE_KEY) as UnitSystem | null
    return stored === 'metric' || stored === 'imperial' ? stored : 'metric'
  })

  const setUnitSystem = useCallback((system: UnitSystem) => {
    localStorage.setItem(STORAGE_KEY, system)
    setUnitSystemState(system)
  }, [])

  const weightUnit = unitSystem === 'metric' ? 'kg' : 'lb'
  const heightUnit = unitSystem === 'metric' ? 'cm' : 'ft-in'
  const circumferenceUnit = unitSystem === 'metric' ? 'cm' : 'in'

  const cmToCircumferenceDisplay = useCallback(
    (cm: number): number => {
      if (unitSystem === 'metric') return Math.round(cm * 10) / 10
      return Math.round((cm / INCH_TO_CM) * 10) / 10
    },
    [unitSystem]
  )

  const circumferenceDisplayToCm = useCallback(
    (val: number): number => {
      if (unitSystem === 'metric') return Math.round(val * 10) / 10
      return Math.round(val * INCH_TO_CM * 10) / 10
    },
    [unitSystem]
  )

  const kgToDisplay = useCallback(
    (kg: number): number => {
      if (unitSystem === 'metric') return Math.round(kg * 10) / 10
      return Math.round(kg * KG_TO_LB * 10) / 10
    },
    [unitSystem]
  )

  const displayToKg = useCallback(
    (val: number): number => {
      if (unitSystem === 'metric') return Math.round(val * 10) / 10
      return Math.round((val / KG_TO_LB) * 10) / 10
    },
    [unitSystem]
  )

  const cmToDisplay = useCallback((cm: number): { feet: number; inches: number } => {
    if (!cm || cm <= 0) return { feet: 0, inches: 0 }
    const totalInches = Math.round(cm / INCH_TO_CM)
    let feet = Math.floor(totalInches / 12)
    let inches = totalInches % 12
    if (inches === 12) {
      feet += 1
      inches = 0
    }
    return { feet, inches }
  }, [])

  const displayToCm = useCallback((feet: number, inches: number): number => {
    const totalInches = Math.max(0, feet) * 12 + Math.max(0, inches)
    return Math.round(totalInches * INCH_TO_CM)
  }, [])

  const formatWeight = useCallback(
    (kg: number | null | undefined, options?: { showUnit?: boolean; decimals?: number }): string => {
      if (kg === null || kg === undefined || isNaN(kg)) return '—'
      const showUnit = options?.showUnit ?? true
      const decimals = options?.decimals ?? 1
      if (unitSystem === 'metric') {
        const val = kg.toFixed(decimals)
        return showUnit ? `${val} kg` : val
      }
      const val = (kg * KG_TO_LB).toFixed(decimals)
      return showUnit ? `${val} lb` : val
    },
    [unitSystem]
  )

  const formatHeight = useCallback(
    (cm: number | null | undefined, options?: { showUnit?: boolean }): string => {
      if (cm === null || cm === undefined || isNaN(cm)) return '—'
      const showUnit = options?.showUnit ?? true
      if (unitSystem === 'metric') {
        const val = Math.round(cm).toString()
        return showUnit ? `${val} cm` : val
      }
      const { feet, inches } = cmToDisplay(cm)
      return `${feet}' ${inches}"`
    },
    [unitSystem, cmToDisplay]
  )

  const formatCircumference = useCallback(
    (cm: number | null | undefined, options?: { showUnit?: boolean; decimals?: number }): string => {
      if (cm === null || cm === undefined || isNaN(cm)) return '—'
      const showUnit = options?.showUnit ?? true
      const decimals = options?.decimals ?? 1
      if (unitSystem === 'metric') {
        const val = cm.toFixed(decimals)
        return showUnit ? `${val} cm` : val
      }
      const val = (cm / INCH_TO_CM).toFixed(decimals)
      return showUnit ? `${val} in` : val
    },
    [unitSystem]
  )

  const value = useMemo<UnitContextType>(
    () => ({
      unitSystem,
      setUnitSystem,
      weightUnit,
      heightUnit,
      circumferenceUnit,
      formatWeight,
      formatHeight,
      formatCircumference,
      kgToDisplay,
      displayToKg,
      cmToDisplay,
      displayToCm,
      cmToCircumferenceDisplay,
      circumferenceDisplayToCm,
    }),
    [
      unitSystem,
      setUnitSystem,
      weightUnit,
      heightUnit,
      circumferenceUnit,
      formatWeight,
      formatHeight,
      formatCircumference,
      kgToDisplay,
      displayToKg,
      cmToDisplay,
      displayToCm,
      cmToCircumferenceDisplay,
      circumferenceDisplayToCm,
    ]
  )

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>
}

export function useUnit(): UnitContextType {
  const context = useContext(UnitContext)
  if (!context) {
    throw new Error('useUnit must be used within a UnitProvider')
  }
  return context
}

