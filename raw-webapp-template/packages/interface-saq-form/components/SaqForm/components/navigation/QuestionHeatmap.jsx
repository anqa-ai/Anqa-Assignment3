/**
 * QuestionHeatmap Component
 * Displays questions in a GitHub-style heatmap grid
 * Each box represents a question and can be clicked to navigate
 * For section 2: displays as rows with question number labels
 */

import React, { useState } from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'

export const QuestionHeatmap = ({
  questions = [],
  responses = {},
  currentQuestionId = null,
  selectedQuestionIds = null,
  onQuestionClick = () => {},
  sectionTitle = 'Questions',
  isOpen = false,
  sectionKey = null,
  minimal = false
}) => {
  const [hoveredQuestion, setHoveredQuestion] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const totalQuestions = questions.length

  // Get question status for color intensity
  const getQuestionIntensity = (question) => {
    const response = responses[question.id]

    // Current question - highest intensity
    if (question.id === currentQuestionId) {
      return 4
    }

    const hasAnswer = response?.value !== null && response?.value !== undefined
    const answerStatus = response?.answerStatus

    // If answered but requires further details or is invalid - RED
    if (hasAnswer && (answerStatus === 'requires_further_details' || answerStatus === 'invalid')) {
      return 2 // Red - needs attention
    }

    // Answered and complete - GREEN
    // Use same logic as Section progress: has answer and no problematic status
    if (hasAnswer) {
      return 3 // Green - has answer and is complete
    }

    // Unanswered - GRAY
    return 1 // Light - unanswered
  }

  const getQuestionText = (question) => (
    question.question_text ||
    question.questionText ||
    question.properties?.question_text ||
    question.rawProperties?.question_text ||
    question.id
  )

  const getBackgroundColor = (intensity, isCurrent) => {
    if (isCurrent || intensity === 4) {
      return SaqFormTheme.colors.primary[600] // Current - blue
    }
    if (intensity === 3) {
      return SaqFormTheme.colors.success[500] // Completed - green
    }
    if (intensity === 2) {
      return SaqFormTheme.colors.error[500] // Needs attention - red
    }
    return SaqFormTheme.colors.neutral[300] // Unanswered - grey
  }

  const renderQuestionButton = (question, titleSuffix = '') => {
    const intensity = getQuestionIntensity(question)
    const isCurrent = question.id === currentQuestionId
    const isSelected = selectedQuestionIds
      ? selectedQuestionIds.has(question.id)
      : isCurrent
    const bgColor = getBackgroundColor(intensity, isCurrent)
    const response = responses[question.id]
    const hasAssignee = response?.assignee || question.assignee
    const borderClass = selectedQuestionIds && isSelected
      ? `border-2 ${SaqFormTheme.colors.neutral.border[400]}`
      : hasAssignee
        ? `border-[3px] ${SaqFormTheme.colors.primary.border[600]}`
        : 'border-none'
    const questionText = getQuestionText(question)
    const title = titleSuffix ? `${titleSuffix}: ${questionText}` : questionText

    return (
      <div key={question.id} className="relative inline-block">
        <button
          type="button"
          onClick={() => onQuestionClick(question)}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top })
            setHoveredQuestion({ id: question.id, title })
          }}
          onMouseLeave={() => setHoveredQuestion(null)}
          className={`h-[16.5px] w-[16.5px] rounded transition-all hover:scale-125 hover:z-10 ${bgColor} ${borderClass} focus:outline-none focus:ring-0`}
        />
      </div>
    )
  }

  const legend = (
    <div className={`flex items-center gap-4 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]}`}>
      <div className="flex items-center gap-1">
        <div className={`h-3 w-3 ${SaqFormTheme.colors.neutral[300]}`}></div>
        <span>Unanswered</span>
      </div>
      <div className="flex items-center gap-1">
        <div className={`h-3 w-3 ${SaqFormTheme.colors.error[500]}`}></div>
        <span>Needs attention</span>
      </div>
      <div className="flex items-center gap-1">
        <div className={`h-3 w-3 ${SaqFormTheme.colors.success[500]}`}></div>
        <span>Answered</span>
      </div>
      <div className="flex items-center gap-1">
        <div className={`h-3 w-3 ${SaqFormTheme.colors.primary[600]}`}></div>
        <span>Current</span>
      </div>
    </div>
  )

  // Extract question number from question object
  const getQuestionNumber = (question) => {
    return question.properties?.number ||
           question.rawProperties?.number ||
           question.questionNumber ||
           null
  }

  // Parse question number to get the main requirement number (e.g., "12.10.1" -> "12")
  const getRequirementNumber = (questionNumber) => {
    if (!questionNumber) return null
    const numStr = String(questionNumber)
    const firstSegment = numStr.split('.')[0]
    return parseInt(firstSegment, 10)
  }

  if (totalQuestions === 0) {
    return null
  }

  if (!isOpen) {
    return null
  }

  // Tooltip component
  const Tooltip = () => {
    if (!hoveredQuestion) return null

    return (
      <div
        className="fixed pointer-events-none z-[100]"
        style={{
          left: `${tooltipPosition.x}px`,
          top: `${tooltipPosition.y}px`,
          transform: 'translate(-50%, calc(-100% - 8px))'
        }}
      >
        <div className={`max-w-xs p-3 ${SaqFormTheme.colors.neutral[900]} text-white ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.borderRadius.md} ${SaqFormTheme.shadows.lg} whitespace-normal break-words`}>
          {hoveredQuestion.title}
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 ${SaqFormTheme.colors.neutral[900]} transform rotate-45`}></div>
        </div>
      </div>
    )
  }

  // For section 2, render as rows with question number labels
  if (sectionKey === 'section2') {
    // Group questions by their requirement number (first segment of question number)
    const questionsByRequirement = {}
    const APPENDIX_KEY = 'Appendix'

    questions.forEach((question) => {
      const questionNumber = getQuestionNumber(question)
      const reqNum = getRequirementNumber(questionNumber)

      // Use 'appendix' key for questions without a valid requirement number
      const key = (reqNum !== null && !isNaN(reqNum)) ? reqNum : APPENDIX_KEY

      if (!questionsByRequirement[key]) {
        questionsByRequirement[key] = []
      }
      questionsByRequirement[key].push({
        question,
        questionNumber,
        reqNum: key
      })
    })

    // Sort by requirement number, with appendix at the end
    const sortedRequirements = Object.keys(questionsByRequirement)
      .map(key => {
        if (key === APPENDIX_KEY) {
          return { key, num: Infinity } // Sort appendix last
        }
        return { key, num: Number(key) }
      })
      .sort((a, b) => a.num - b.num)
      .map(({ key }) => ({
        reqNum: key,
        questions: questionsByRequirement[key].sort((a, b) => {
          // Sort questions within each requirement by their full number
          const numA = String(a.questionNumber || '').split('.').map(Number)
          const numB = String(b.questionNumber || '').split('.').map(Number)

          // Compare segment by segment
          for (let i = 0; i < Math.max(numA.length, numB.length); i++) {
            const segA = numA[i] || 0
            const segB = numB[i] || 0
            if (segA !== segB) {
              return segA - segB
            }
          }
          return 0
        })
      }))

    const section2Content = (
      <div
        className="flex flex-col gap-0.5 w-full"
      >
        {selectedQuestionIds && (
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-shrink-0 w-32 text-right"></div>
            <div className="flex-1"></div>
            <div className="flex-shrink-0 w-20 text-right">
              <span className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]}`}>
                Select all
              </span>
            </div>
          </div>
        )}
        {sortedRequirements.map(({ reqNum, questions: reqQuestions }) => {
          const allSelectedInRow = selectedQuestionIds
            ? reqQuestions.every(({ question }) => selectedQuestionIds.has(question.id))
            : false

          const toggleRowSelection = (shouldSelect) => {
            if (!selectedQuestionIds) return
            reqQuestions.forEach(({ question }) => {
              const isSelected = selectedQuestionIds.has(question.id)
              if (shouldSelect && !isSelected) {
                onQuestionClick(question)
              }
              if (!shouldSelect && isSelected) {
                onQuestionClick(question)
              }
            })
          }

          return (
            <div key={reqNum} className="flex items-center gap-3">
              {/* Question number label on the left */}
              <div className="flex-shrink-0 w-32 text-right">
                <span className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[700]}`}>
                  {reqNum === 'Appendix' ? 'Appendix' : `Requirement ${reqNum}`}
                </span>
              </div>

              {/* Question boxes on the right */}
              <div className="flex-1 flex flex-wrap gap-1">
                {reqQuestions.map(({ question, questionNumber }) => (
                  renderQuestionButton(question, questionNumber || '')
                ))}
              </div>

              {/* Select all checkbox per row (assign modal only) */}
              {selectedQuestionIds && (
                <div className="flex-shrink-0 w-20 flex justify-end">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-slate-300 bg-white"
                    checked={allSelectedInRow}
                    onChange={(event) => toggleRowSelection(event.target.checked)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )

    if (minimal) {
      return (
        <>
          <Tooltip />
          {section2Content}
        </>
      )
    }

    return (
      <>
        <Tooltip />
        <div className={`mt-3 ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[200]} ${SaqFormTheme.colors.neutral[50]} p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]}`}>
              Click any box to jump to that question
            </p>
            {legend}
          </div>
          {section2Content}
        </div>
      </>
    )
  }

  // For other sections: use existing grid layout
  // Calculate grid dimensions
  const cols = totalQuestions <= 35 ? totalQuestions : 35

  const gridContent = (
    <div
      className="flex justify-center w-full"
    >
      <div
        className="inline-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 16.5px)`,
          gap: '2px',
          justifyContent: 'center'
        }}
      >
        {questions.map((question) => renderQuestionButton(question))}
      </div>
    </div>
  )

  if (minimal) {
    return (
      <>
        <Tooltip />
        {gridContent}
      </>
    )
  }

  return (
    <>
      <Tooltip />
      <div className={`mt-3 ${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.neutral.border[200]} ${SaqFormTheme.colors.neutral[50]} p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <p className={`${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[600]}`}>
            Click any box to jump to that question
          </p>
          {legend}
        </div>
        {gridContent}
      </div>
    </>
  )
}
