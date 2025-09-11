import tempfile, os
# should succeed; if this fails, your local FS is the issue
open(os.path.join(tempfile.gettempdir(), "mlflow_tmp_probe"), "w").write("ok")

import mlflow
with mlflow.start_run():
    # force an artifact write to the server
    p = os.path.join(tempfile.gettempdir(), "probe.txt")
    open(p, "w").write("hello")
    mlflow.log_artifact(p)  # if THIS fails: server-side perms; if it succeeds: client temp dir is fixed
