useEffect(() => {
  const init = async () => {
    setModelsLoading(true);
    const loaded = await loadModels();
    setModelsReady(loaded);
    setModelsLoading(false);
  };
  init();
  startWebcam();
  return () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };
}, []);
