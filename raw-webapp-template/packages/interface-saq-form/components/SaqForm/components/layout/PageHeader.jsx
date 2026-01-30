/**
 * PageHeader Component
 * Top header with actions (Collaborators)
 */

import React, { useState } from 'react'
import { SaqFormTheme } from '../../SaqFormTheme'
import { ShareEmailPanel } from '../../SaqFormUI'

export const PageHeader = ({ 
  onShare,
  onRemove,
  hasReadyToSubmitQuestionnaire = false,
  activeSection = '',
  onNavigateToSigning = () => {},
  questionnaireMeta = {},
  instanceUuid = null,
  onSharePanelClose = () => {}
}) => {
  const [isSharePanelOpen, setIsSharePanelOpen] = useState(false)

  const handleShare = async (collaboratorData) => {
    if (onShare) {
      await onShare(collaboratorData)
    }
  }

  const handleRemove = async (collaborator) => {
    if (onRemove) {
      await onRemove(collaborator)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={`${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.medium} uppercase ${SaqFormTheme.colors.primary.text[500]} tracking-wide inline-flex items-center h-10`}>
            PCI Compliance
          </p>
        </div>
        <div className="flex flex-col gap-2 self-start sm:self-auto">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsSharePanelOpen(!isSharePanelOpen)}
              className={`${SaqFormTheme.borderRadius.md} border ${SaqFormTheme.colors.primary.border[500]} bg-white px-4 py-2 ${SaqFormTheme.typography.fontSize.sm} ${SaqFormTheme.typography.fontWeight.semibold} ${SaqFormTheme.colors.primary.text[600]} ${SaqFormTheme.shadows.sm} hover:${SaqFormTheme.colors.primary[50]} flex items-center gap-2 h-10`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Collaborators
            </button>
          </div>
        </div>
      </div>
      
      {/* Share Email Panel */}
      <ShareEmailPanel 
        isOpen={isSharePanelOpen} 
        onClose={() => {
          setIsSharePanelOpen(false)
          onSharePanelClose()
        }}
        onShare={handleShare}
        onRemove={handleRemove}
        questionnaireMeta={questionnaireMeta}
        instanceUuid={instanceUuid}
      />
    </div>
  )
}
