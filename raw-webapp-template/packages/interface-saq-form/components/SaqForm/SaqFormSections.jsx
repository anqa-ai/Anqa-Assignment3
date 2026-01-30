/**
 * SAQ Form Sections - Decision, Amendment, and Applicability
 * These are the initial sections for identifying channels and selecting SAQs
 */

import React, { useMemo } from 'react'
import { SAQ_DEFINITIONS, APPLICABILITY_QUESTIONS } from './SaqFormConstants'
import { SaqFormTheme, getButtonClasses, getBadgeClasses } from './SaqFormTheme'
import { 
  SectionHeader, 
  PaymentChannelCard, 
  FollowUpQuestion,
  YesNoToggle,
  SAQDefinitionCard,
  ApplicabilityBadge,
  NavigationButtons,
  InfoBox
} from './SaqFormUI'
import { isQuestionVisible } from './SaqConditionalLogic'

/**
 * Convert paymentAnswers format to responses format for conditional logic
 * paymentAnswers: {questionId: boolean}
 * responses: {questionId: {value: boolean}}
 */
const convertPaymentAnswersToResponses = (paymentAnswers) => {
  const responses = {}
  Object.keys(paymentAnswers).forEach(key => {
    responses[key] = { value: paymentAnswers[key] }
  })
  return responses
}

/**
 * Dynamic Payment Question Renderer
 * Renders a question with conditional follow-up questions based on API data
 */
const DynamicPaymentQuestion = ({ question, paymentAnswers, handleAnswerToggle, allQuestions = [] }) => {
  const questionId = question.id
  const value = paymentAnswers[questionId]
  const properties = question.properties || {}
  const context = properties.context || []
  const resultMessages = properties.result_messages || {}
  
  // Get result message for current value
  const resultMessage = value !== undefined && resultMessages[String(value)] ? resultMessages[String(value)] : null
  
  // Find follow-up questions that depend on this question
  const responses = convertPaymentAnswersToResponses(paymentAnswers)
  const directFollowUps = allQuestions.filter(q => {
    const dependsOn = q.rawProperties?.depends_on || q.properties?.depends_on
    if (!dependsOn || !dependsOn.direct) return false
    
    // Check if this question depends directly on the current question
    const dependsOnCurrent = dependsOn.direct.some(dep => dep.question_uuid === question.question_uuid)
    if (!dependsOnCurrent) return false
    
    // Check if the dependency is met (question should be visible)
    return isQuestionVisible(q, responses, allQuestions)
  })

  return (
    <PaymentChannelCard
      title={question.question_text}
      subtitle={question.description}
      description={context}
      value={value}
      onToggle={(val) => handleAnswerToggle(questionId, val)}
      resultMessage={resultMessage}
    >
      {value && directFollowUps.length > 0 && (
        <div className="mt-4 space-y-4">
          {directFollowUps.map((followUp) => {
            const followUpId = followUp.id
            const followUpValue = paymentAnswers[followUpId]
            const followUpProperties = followUp.properties || {}
            const followUpResults = followUpProperties.result_messages || {}
            
            return (
              <FollowUpQuestion
                key={followUpId}
                title="Follow-up:"
                question={followUp.question_text}
                value={followUpValue}
                onToggle={(val) => handleAnswerToggle(followUpId, val)}
                yesLabel="Yes"
                noLabel="No"
                yesResultMessage={followUpResults['true']}
                noResultMessage={followUpResults['false']}
              />
            )
          })}
        </div>
      )}
    </PaymentChannelCard>
  )
}

export const DecisionSection = ({
  paymentAnswers = {},
  handleAnswerToggle,
  handleChannelSubmit,
  paymentServicesQuestions = [],
  isLoadingPaymentQuestions = false,
  paymentQuestionsError = null
}) => {
  // Identify parent questions (questions with no depends_on)
  const parentQuestions = useMemo(() => {
    if (!paymentServicesQuestions || paymentServicesQuestions.length === 0) {
      return []
    }
    return paymentServicesQuestions.filter(q => {
      const dependsOn = q.rawProperties?.depends_on || q.properties?.depends_on
      return !dependsOn || !dependsOn.direct || dependsOn.direct.length === 0
    })
  }, [paymentServicesQuestions])
  
  // Sort parent questions by ordinal to ensure correct display order
  const sortedMainQuestions = [...parentQuestions].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0))

  return (
    <section className="space-y-8">
      <SectionHeader
        title="Identify Your Payment Services"
        description="Answer the following questions about your payment processing to determine which SAQ questionnaires you need to complete."
      />

      {isLoadingPaymentQuestions && (
        <InfoBox type="info">
          Loading payment channel questions...
        </InfoBox>
      )}

      {paymentQuestionsError && (
        <InfoBox type="error">
          {paymentQuestionsError}
        </InfoBox>
      )}

      {!isLoadingPaymentQuestions && !paymentQuestionsError && sortedMainQuestions.length === 0 && (
        <InfoBox type="warning">
          No payment questions available. Using default questions.
        </InfoBox>
      )}

      <div className="space-y-5">
        {sortedMainQuestions.length > 0 ? (
          // Render dynamic questions from API
          sortedMainQuestions.map((question) => (
            <DynamicPaymentQuestion
              key={question.id}
              question={question}
              paymentAnswers={paymentAnswers}
              handleAnswerToggle={handleAnswerToggle}
              allQuestions={paymentServicesQuestions}
            />
          ))
        ) : !isLoadingPaymentQuestions && !paymentQuestionsError ? (
          // Fallback to hardcoded questions if API questions not available
          <>
            {/* Question 1: AllPayments Services */}
            <PaymentChannelCard
              title="Do you have any of the following payment services through AllPayments.net?"
              description={[
                'IVR phone payments',
                'Payment gateway',
                'Pay by link',
                'CallPay with call masking'
              ]}
              value={paymentAnswers.has_allpayments_services}
              onToggle={(val) => handleAnswerToggle('has_allpayments_services', val)}
              resultMessage={paymentAnswers.has_allpayments_services ? '→ This will require SAQ A' : null}
            />

            {/* Question 2: Internet Payments */}
            <PaymentChannelCard
              title="Do you process Internet payments?"
              subtitle="Online payments via your website"
              value={paymentAnswers.has_internet_payments}
              onToggle={(val) => handleAnswerToggle('has_internet_payments', val)}
            >
              {paymentAnswers.has_internet_payments && (
                <FollowUpQuestion
                  title="Follow-up:"
                  question="Is there a redirect link from your website back to www.allpayments.net?"
                  value={paymentAnswers.internet_redirects_to_allpayments}
                  onToggle={(val) => handleAnswerToggle('internet_redirects_to_allpayments', val)}
                  yesLabel="Yes, redirects to AllPayments"
                  noLabel="No redirect"
                  yesResultMessage="→ This will require SAQ A"
                  noResultMessage="→ No SAQ required for this channel"
                />
              )}
            </PaymentChannelCard>

            {/* Question 3: Text Payments */}
            <PaymentChannelCard
              title="Do you process Text payments?"
              subtitle="SMS or text-based payment services"
              value={paymentAnswers.has_text_payments}
              onToggle={(val) => handleAnswerToggle('has_text_payments', val)}
            >
              {paymentAnswers.has_text_payments && (
                <FollowUpQuestion
                  title="Follow-up:"
                  question="Is there a redirect from your website to https://www.allpayments.net/TextPay/?"
                  value={paymentAnswers.text_redirects_to_allpayments}
                  onToggle={(val) => handleAnswerToggle('text_redirects_to_allpayments', val)}
                  yesLabel="Yes, redirects to TextPay"
                  noLabel="No redirect"
                  yesResultMessage="→ This will require SAQ A"
                  noResultMessage="→ No SAQ required for this channel"
                />
              )}
            </PaymentChannelCard>

            {/* Question 4: CallPay */}
            <PaymentChannelCard
              title="Do you use CallPay?"
              subtitle="Virtual terminal for manual card entry"
              value={paymentAnswers.uses_callpay}
              onToggle={(val) => handleAnswerToggle('uses_callpay', val)}
            >
              {paymentAnswers.uses_callpay && (
                <div className="mt-4 space-y-4">
                  <FollowUpQuestion
                    title="Follow-up 1:"
                    question="Are the devices that are accessing CallPay isolated in a single location (network)?"
                    value={paymentAnswers.callpay_devices_isolated}
                    onToggle={(val) => handleAnswerToggle('callpay_devices_isolated', val)}
                    yesLabel="Yes, isolated"
                    noLabel="No, not isolated"
                    variant="warning"
                    noResultMessage="→ This will require SAQ D (not isolated)"
                  />

                  {paymentAnswers.callpay_devices_isolated && (
                    <FollowUpQuestion
                      title="Follow-up 2:"
                      question="Are the devices that are accessing CallPay connected to any other locations or systems?"
                      value={paymentAnswers.callpay_devices_connected_elsewhere}
                      onToggle={(val) => handleAnswerToggle('callpay_devices_connected_elsewhere', val)}
                      yesLabel="Yes, connected elsewhere"
                      noLabel="No, not connected"
                      variant="primary"
                      yesResultMessage="→ This will require SAQ D (connected to other systems)"
                      noResultMessage="→ This will require SAQ C-VT (isolated and not connected)"
                    />
                  )}
                </div>
              )}
            </PaymentChannelCard>
          </>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleChannelSubmit}
            className={getButtonClasses('primary', 'lg', false)}
          >
            Analyze & Recommend SAQs →
          </button>
        </div>
      </div>
    </section>
  )
}

export const AmendmentSection = ({
  suggestedSAQs = [],
  selectedSAQs = [],
  paymentAnswers = {},
  paymentServicesQuestions = [],
  handleSAQToggle,
  handleProceedToQuestionnaires,
  onBack
}) => {
  // Build dynamic breakdown from questions with saq_mapping
  const getDynamicSAQBreakdown = () => {
    const breakdown = []
    
    paymentServicesQuestions.forEach((question) => {
      const jsonPath = question.properties?.json_path
      const saqMapping = question.properties?.saq_mapping
      const questionText = question.question_text
      
      if (!jsonPath || !saqMapping) return
      
      const userAnswer = paymentAnswers[jsonPath]
      let mappingKey = String(userAnswer)
      if (userAnswer === true) mappingKey = 'true'
      if (userAnswer === false) mappingKey = 'false'
      
      const saqList = saqMapping[mappingKey]
      
      if (Array.isArray(saqList) && saqList.length > 0) {
        breakdown.push({
          question: questionText,
          saqs: saqList,
          answer: userAnswer
        })
      }
    })
    
    return breakdown
  }

  const dynamicBreakdown = getDynamicSAQBreakdown()

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Review SAQs"
        description="Based on your payment channels, we recommend the following SAQs. You can add or remove SAQs if our analysis doesn't match your situation."
      />

      {/* System Recommendation Box */}
      <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.primary.border[200]} ${SaqFormTheme.colors.primary[50]} p-6 ${SaqFormTheme.shadows.sm}`}>
        <h3 className={`${SaqFormTheme.typography.fontSize.lg} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.primary.text[900]} mb-2`}>System Recommendation</h3>
        <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.primary.text[800]} mb-4`}>
          {suggestedSAQs.length === 0 && 'No SAQs identified based on your answers. Please review your responses.'}
          {suggestedSAQs.length === 1 && `We recommend completing ${suggestedSAQs[0]} based on your payment services.`}
          {suggestedSAQs.length > 1 && `Your business uses multiple payment services. We recommend completing ${suggestedSAQs.length} SAQs: ${suggestedSAQs.join(', ')}.`}
        </p>
        <div className={`space-y-2 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.primary.text[800]}`}>
          {dynamicBreakdown.length > 0 ? (
            // Show dynamic breakdown from API questions
            dynamicBreakdown.map((item, idx) => (
              <p key={idx}>
                ✓ {item.question.substring(0, 60)}{item.question.length > 60 ? '...' : ''} → {item.saqs.join(', ')}
              </p>
            ))
          ) : (
            // Fallback to hardcoded breakdown
            <>
              {paymentAnswers.has_allpayments_services && (
                <p>✓ AllPayments.net services → SAQ A</p>
              )}
              {paymentAnswers.has_internet_payments && paymentAnswers.internet_redirects_to_allpayments && (
                <p>✓ Internet payments with redirect → SAQ A</p>
              )}
              {paymentAnswers.has_text_payments && paymentAnswers.text_redirects_to_allpayments && (
                <p>✓ Text payments with redirect → SAQ A</p>
              )}
              {paymentAnswers.uses_callpay && paymentAnswers.callpay_devices_isolated && !paymentAnswers.callpay_devices_connected_elsewhere && (
                <p>✓ CallPay (isolated) → SAQ C-VT</p>
              )}
              {paymentAnswers.uses_callpay && (!paymentAnswers.callpay_devices_isolated || paymentAnswers.callpay_devices_connected_elsewhere) && (
                <p>✓ CallPay (not isolated) → SAQ D</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* SAQ Selection Cards */}
      <div className="space-y-4">
        <h3 className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} uppercase tracking-wide ${SaqFormTheme.colors.neutral.text[500]} text-center`}>
          Available SAQ Types - Select All That Apply
        </h3>
        
        {Object.values(SAQ_DEFINITIONS).map((saq) => {
          const isSelected = selectedSAQs.includes(saq.name)
          const isSuggested = suggestedSAQs.includes(saq.name)
          
          return (
            <SAQDefinitionCard
              key={saq.name}
              saq={saq}
              isSelected={isSelected}
              isSuggested={isSuggested}
              onToggle={() => handleSAQToggle(saq.name)}
            />
          )
        })}
      </div>

      {/* Amendment Notes */}
      <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.warning.border[200]} ${SaqFormTheme.colors.warning[50]} p-5 ${SaqFormTheme.shadows.sm}`}>
        <h3 className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.warning.text[900]} mb-2`}>💡 Important Information</h3>
        <ul className={`space-y-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.warning.text[800]}`}>
          <li>• You may add additional SAQs that weren't automatically detected if applicable to your business.</li>
          <li>• You can remove suggested SAQs if they don't apply (be sure to document your justification).</li>
          <li>• When in doubt, please consult with your QSA or acquiring bank before continuing.</li>
          <li>• All selected SAQs will be evaluated in the subsequent sections of this assessment.</li>
        </ul>
      </div>

      {/* Selection Summary */}
      <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-5 ${SaqFormTheme.shadows.sm}`}>
        <h3 className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[900]} mb-3`}>Your Selection</h3>
        <div className="flex items-center justify-between">
          <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]}`}>
            {selectedSAQs.length === 0 && 'No SAQs selected yet. Please choose at least one to proceed.'}
            {selectedSAQs.length === 1 && `1 SAQ currently selected: ${selectedSAQs[0]}`}
            {selectedSAQs.length > 1 && `${selectedSAQs.length} SAQs currently selected: ${selectedSAQs.join(', ')}`}
          </p>
          {selectedSAQs.length > 0 && (
            <span className={getBadgeClasses('success')}>
              ✓ Ready
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <NavigationButtons
        onForward={handleProceedToQuestionnaires}
        forwardLabel="Confirm & Proceed →"
        forwardDisabled={selectedSAQs.length === 0}
      />
    </section>
  )
}

export const ApplicabilitySection = ({
  applicability,
  handleApplicabilityToggle,
  handleProceedToChecklist,
  onBack
}) => {
  return (
    <section className="space-y-6">
      <div className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-6 ${SaqFormTheme.shadows.sm}`}>
        <h2 className={`${SaqFormTheme.typography.fontSize.xl} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[900]}`}>Section 1 — Environment & Applicability</h2>
        <p className={`mt-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]}`}>
          Answer these scoping questions to help us tailor the assessment to your specific environment.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {APPLICABILITY_QUESTIONS.map((question) => (
            <ApplicabilityBadge
              key={question.key}
              tag={question.tag}
              isActive={applicability[question.key]}
            />
          ))}
        </div>
      </div>

      <div className="space-y-5">
        {APPLICABILITY_QUESTIONS.map((question) => {
          const value = applicability[question.key]
          return (
            <div key={question.key} className={`${SaqFormTheme.borderRadius.xl} border ${SaqFormTheme.colors.neutral.border[200]} bg-white p-5 ${SaqFormTheme.shadows.sm}`}>
              <div className="flex flex-col gap-3">
                <div>
                  <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.neutral.text[900]}`}>{question.label}</p>
                  <p className={`mt-1 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.colors.neutral.text[600]}`}>{question.helper}</p>
                </div>
                <YesNoToggle
                  value={value}
                  onToggle={(val) => handleApplicabilityToggle(question.key, val)}
                />
                <div className={`flex items-center gap-2 ${SaqFormTheme.typography.fontSize.xs} ${SaqFormTheme.colors.neutral.text[500]}`}>
                  <span className={`${SaqFormTheme.typography.fontWeight.semibold} uppercase tracking-wide ${SaqFormTheme.colors.neutral.text[400]}`}>Tag</span>
                  <span className={`${SaqFormTheme.borderRadius.full} border ${SaqFormTheme.colors.neutral.border[200]} px-2 py-0.5 text-[11px] uppercase tracking-wide`}>
                    {question.tag}
                  </span>
                  <span>{value ? 'Applicable' : 'Not applicable'}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <NavigationButtons
        onForward={handleProceedToChecklist}
        forwardLabel="Proceed to Checklist →"
      />
    </section>
  )
}
