import PropTypes from 'prop-types';
import OfflineIndicator from '@/components/OfflineIndicator';
import YjsSyncStatus from '@/components/sync/YjsSyncStatus';

const CloudSyncStatusPanel = ({ className = '', isCompact = false, onActionComplete }) => {
    return (
        <div className={className}>
            <YjsSyncStatus isCompact={isCompact} onActionComplete={onActionComplete} />
            <OfflineIndicator isCompact={isCompact} />
        </div>
    );
};

CloudSyncStatusPanel.propTypes = {
    className: PropTypes.string,
    isCompact: PropTypes.bool,
    onActionComplete: PropTypes.func,
};

export default CloudSyncStatusPanel;