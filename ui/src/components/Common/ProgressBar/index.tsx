import React from 'react'
import './progressBar.scss'
import cn from 'classnames'

/**
 * Props for the ProgressBar component.
 */
type ProgressBarProps = {
  /**
   * The percentage value for the progress.
   */
  percentage: number
  /**
   * The color of the progress bar.
   */
  color?: string
  /**
   * The height of the progress bar in pixels.
   */
  height?: number
  /**
   * The border radius of the progress bar in pixels.
   */
  borderRadius?: number
  /**
   * The type of progress bar. Can be 'bar' or 'circle'.
   */
  type?: 'bar' | 'circle',
  /**
   * The stroke width of the circle progress bar.
   */
  stroke?: number
  /**
   * The radius of the circle progress bar.
   */
  radius?: number | undefined
  /**
   * The background color of the circle progress bar.
   */
  bgColor?: string
}

/**
 * Interface for defining CSS styles.
 */
type IStyle = {
  [key: string]: string
}

/**
 * A customizable progress bar component.
 * @param props - The props for the ProgressBar component.
 * @returns The rendered ProgressBar component.
 */
const ProgressBar = (props: ProgressBarProps) => {
  const { percentage, color, height, borderRadius, type, radius, stroke, bgColor } = props

  const containerStyle: IStyle = {}
  const barStyle: IStyle = {
    width: '0%',
  };

  if (height) {
    containerStyle.height = `${height}px`
  }

  if (borderRadius) {
    containerStyle.borderRadius = `${borderRadius}px`
  }

  if (percentage) {
    barStyle.width = `${percentage}%`
  }

  if (color) {
    barStyle.backgroundColor = color
  }
  if (type === 'circle') {
    const normalizedRadius: any = (radius || 0 - (stroke || 0))  * 2;
    const circumference: any = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset: any = circumference - percentage / 100 * circumference;
    return (
      <>
        <svg
          height={radius || 0 * 2}
          width={radius || 0 * 2}
        >
          <circle
            className="ProgressBar__circle"
            stroke={bgColor}
            fill="transparent"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            className="ProgressBar__circle"
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
      </>
    );
  }
  return (
    <div className="ProgressBar" style={containerStyle}>
      <div className={cn('ProgressBar__bar')} style={barStyle} />
    </div>
  )
}

ProgressBar.defaultProps = {
  color: '#52c0ff',
  borderRadius: 4, 
  height: 5, 
  type: "bar",
  stroke: 4,
  radius: 20,
  bgColor: "white"
} as Partial<ProgressBarProps>

export default ProgressBar