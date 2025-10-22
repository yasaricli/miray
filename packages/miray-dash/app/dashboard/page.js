'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [keys, setKeys] = useState([]);
  const [keyMetadata, setKeyMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const keysPerPage = 50;

  useEffect(() => {
    // Check if connected
    const connInfo = sessionStorage.getItem('miray_connection');
    if (!connInfo) {
      router.push('/');
      return;
    }

    setConnectionInfo(JSON.parse(connInfo));
    loadData();

    // Refresh every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [router]);

  const loadData = async () => {
    try {
      const connInfo = JSON.parse(sessionStorage.getItem('miray_connection'));

      const [statsRes, keysRes] = await Promise.all([
        fetch('/api/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(connInfo),
        }),
        fetch('/api/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(connInfo),
        }),
      ]);

      const statsData = await statsRes.json();
      const keysData = await keysRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }

      if (keysData.success) {
        setKeys(keysData.data);
      }

      setError('');
    } catch (err) {
      setError('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem('miray_connection');
    router.push('/');
  };

  const handleDeleteKey = async (key) => {
    if (!confirm(`Delete key "${key}"?`)) return;

    try {
      const connInfo = JSON.parse(sessionStorage.getItem('miray_connection'));
      const response = await fetch('/api/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...connInfo, key }),
      });

      const data = await response.json();

      if (data.success) {
        loadData(); // Reload data
      } else {
        alert('Failed to delete key: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // Filter keys based on search
  const filteredKeys = keys.filter((key) =>
    key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredKeys.length / keysPerPage);
  const startIndex = (currentPage - 1) * keysPerPage;
  const endIndex = startIndex + keysPerPage;
  const currentKeys = filteredKeys.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Load metadata for visible keys
  useEffect(() => {
    const loadKeyMetadata = async () => {
      if (currentKeys.length === 0) return;

      const connInfo = JSON.parse(sessionStorage.getItem('miray_connection'));
      const newMetadata = { ...keyMetadata };

      // Load metadata for keys that don't have it yet
      const keysToLoad = currentKeys.filter((key) => !newMetadata[key]);

      if (keysToLoad.length > 0) {
        try {
          const metadataPromises = keysToLoad.map(async (key) => {
            const response = await fetch('/api/keyinfo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...connInfo, key }),
            });
            const data = await response.json();
            return { key, info: data.success ? data.data : null };
          });

          const results = await Promise.all(metadataPromises);
          results.forEach(({ key, info }) => {
            newMetadata[key] = info;
          });

          setKeyMetadata(newMetadata);
        } catch (err) {
          console.error('Failed to load key metadata:', err);
        }
      }
    };

    loadKeyMetadata();
  }, [currentKeys]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <nav className="navbar navbar-dark bg-dark shadow-sm">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <span className="logo-text" style={{ color: 'white' }}>
              MIRAY
            </span>{' '}
            Dashboard
          </span>
          <div className="d-flex align-items-center">
            <span className="badge bg-success me-3">
              Connected to {connectionInfo?.host}:{connectionInfo?.port}
            </span>
            <button className="btn btn-outline-light btn-sm" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid py-4">
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="row g-4 mb-4">
            <div className="col-md-3">
              <div className="stat-card">
                <div className="stat-label">Total Keys</div>
                <div className="stat-value">{stats.keys || 0}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="stat-card">
                <div className="stat-label">Memory Usage</div>
                <div className="stat-value">
                  {stats.memory ? (stats.memory / 1024).toFixed(2) : 0} KB
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="stat-card">
                <div className="stat-label">Total Operations</div>
                <div className="stat-value">{stats.opsTotal || 0}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="stat-card">
                <div className="stat-label">Active Connections</div>
                <div className="stat-value">{stats.activeConnections || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Stats */}
        {stats && (
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">Storage Statistics</h5>
                </div>
                <div className="card-body">
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <td>Total Reads</td>
                        <td className="text-end fw-bold">{stats.reads || 0}</td>
                      </tr>
                      <tr>
                        <td>Total Writes</td>
                        <td className="text-end fw-bold">{stats.writes || 0}</td>
                      </tr>
                      <tr>
                        <td>Total Deletes</td>
                        <td className="text-end fw-bold">{stats.deletes || 0}</td>
                      </tr>
                      <tr>
                        <td>Ops Since Checkpoint</td>
                        <td className="text-end fw-bold">{stats.opsSinceCheckpoint || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card">
                <div className="card-header bg-success text-white">
                  <h5 className="mb-0">Server Information</h5>
                </div>
                <div className="card-body">
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <td>Uptime</td>
                        <td className="text-end fw-bold">
                          {stats.uptime ? Math.floor(stats.uptime / 60) : 0} minutes
                        </td>
                      </tr>
                      <tr>
                        <td>Total Connections</td>
                        <td className="text-end fw-bold">{stats.totalConnections || 0}</td>
                      </tr>
                      <tr>
                        <td>Peak Connections</td>
                        <td className="text-end fw-bold">{stats.peakConnections || 0}</td>
                      </tr>
                      <tr>
                        <td>Commands Processed</td>
                        <td className="text-end fw-bold">{stats.commandsProcessed || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keys List */}
        <div className="card">
          <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Keys ({keys.length})</h5>
            <button className="btn btn-sm btn-light" onClick={loadData}>
              <i className="bi bi-arrow-clockwise"></i> Refresh
            </button>
          </div>
          <div className="card-body">
            {/* Search Bar */}
            <div className="mb-3">
              <input
                type="text"
                className="form-control"
                placeholder="Search keys..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>

            {keys.length === 0 ? (
              <div className="text-center text-muted py-5">
                <p>No keys found</p>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="text-center text-muted py-5">
                <p>No keys match your search</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th className="text-center">Reads</th>
                        <th className="text-center">Writes</th>
                        <th className="text-center">TTL</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentKeys.map((key, index) => {
                        const metadata = keyMetadata[key];
                        return (
                          <tr key={index}>
                            <td>
                              <code>{key}</code>
                            </td>
                            <td className="text-center">
                              {metadata ? (
                                <span className="badge bg-info">{metadata.reads || 0}</span>
                              ) : (
                                <span className="spinner-border spinner-border-sm" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </span>
                              )}
                            </td>
                            <td className="text-center">
                              {metadata ? (
                                <span className="badge bg-success">{metadata.writes || 0}</span>
                              ) : (
                                <span className="spinner-border spinner-border-sm" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </span>
                              )}
                            </td>
                            <td className="text-center">
                              {metadata ? (
                                metadata.ttl === -1 ? (
                                  <span className="badge bg-secondary">No expiry</span>
                                ) : metadata.ttl === -2 ? (
                                  <span className="badge bg-danger">Expired</span>
                                ) : (
                                  <span className="badge bg-warning text-dark">
                                    {metadata.ttl}s
                                  </span>
                                )
                              ) : (
                                <span className="spinner-border spinner-border-sm" role="status">
                                  <span className="visually-hidden">Loading...</span>
                                </span>
                              )}
                            </td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteKey(key)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <div className="text-muted">
                      Showing {startIndex + 1}-{Math.min(endIndex, filteredKeys.length)} of{' '}
                      {filteredKeys.length} keys
                    </div>
                    <nav>
                      <ul className="pagination mb-0">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                          <button
                            className="page-link"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </button>
                        </li>
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          // Show pages around current page
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <li
                              key={pageNum}
                              className={`page-item ${currentPage === pageNum ? 'active' : ''}`}
                            >
                              <button
                                className="page-link"
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            </li>
                          );
                        })}
                        <li
                          className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}
                        >
                          <button
                            className="page-link"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </button>
                        </li>
                      </ul>
                    </nav>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
