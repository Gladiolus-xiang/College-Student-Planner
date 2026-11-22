import type { CourseSlot } from '../types'

/** 示例课表：杭电大一某专业第一学期，演示用，可在 UI 里改 */
export const SAMPLE_COURSES: CourseSlot[] = [
  { id: 'c1', name: '高等数学', weekday: 1, start: '08:00', end: '09:40' },
  { id: 'c2', name: '大学英语', weekday: 1, start: '10:00', end: '11:40' },
  { id: 'c3', name: '程序设计基础', weekday: 2, start: '08:00', end: '09:40' },
  { id: 'c4', name: '大学物理', weekday: 2, start: '14:00', end: '15:40' },
  { id: 'c5', name: '高等数学', weekday: 3, start: '10:00', end: '11:40' },
  { id: 'c6', name: '体育', weekday: 3, start: '15:00', end: '16:30' },
  { id: 'c7', name: '大学英语', weekday: 4, start: '08:00', end: '09:40' },
  { id: 'c8', name: '程序设计实验', weekday: 4, start: '14:00', end: '16:00' },
  { id: 'c9', name: '大学物理', weekday: 5, start: '10:00', end: '11:40' },
]
